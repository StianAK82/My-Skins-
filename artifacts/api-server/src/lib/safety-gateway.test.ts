import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PROMPT_LENGTH,
  RateLimiter,
  SafetyError,
  assertImageAllowed,
  hashImage,
  parseImageSafetyVerdict,
  applyIpProtection,
  checkPromptLength,
  detectPii,
  evaluatePrompt,
  hashPrompt,
  lookupDecision,
  moderatePrompt,
  recordDecision,
} from "./safety-gateway";

function expectSafetyError(fn: () => unknown, code: string): SafetyError {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof SafetyError, `expected SafetyError, got ${err}`);
    assert.equal(err.code, code);
    return err;
  }
  assert.fail(`expected SafetyError ${code} but nothing was thrown`);
}

describe("prompt length", () => {
  test("allows prompts up to the limit", () => {
    checkPromptLength("a".repeat(MAX_PROMPT_LENGTH));
  });

  test("blocks prompts over the limit with PROMPT_TOO_LONG", () => {
    const err = expectSafetyError(() => checkPromptLength("a".repeat(MAX_PROMPT_LENGTH + 1)), "PROMPT_TOO_LONG");
    assert.equal(err.httpStatus, 400);
    assert.match(err.message, /for lang/i);
  });
});

describe("PII detection", () => {
  test("clean creative prompts have no PII", () => {
    assert.deepEqual(detectPii("en kul drage med gullvinger og blå hettegenser"), []);
  });

  test("detects emails", () => {
    assert.ok(detectPii("send til ola@example.com").includes("email"));
  });

  test("detects phone numbers", () => {
    assert.ok(detectPii("ring meg på 41234567").includes("phone"));
    assert.ok(detectPii("+47 412 34 567").includes("phone"));
  });

  test("detects national id numbers", () => {
    assert.ok(detectPii("010101 12345").includes("national_id"));
  });

  test("detects street addresses", () => {
    assert.ok(detectPii("jeg bor i Storgata 12").includes("address"));
    assert.ok(detectPii("Bjørkeveien 3B").includes("address"));
  });

  test("detects self-identification with full name", () => {
    assert.ok(detectPii("jeg heter Ola Nordmann").includes("name"));
  });

  test("evaluatePrompt blocks PII with PII_DETECTED", () => {
    expectSafetyError(() => evaluatePrompt("skin til ola@example.com"), "PII_DETECTED");
  });
});

describe("moderation", () => {
  test("harmless kid prompts pass", () => {
    assert.deepEqual(moderatePrompt("ninja med sverd og drage på ryggen"), []);
    assert.deepEqual(moderatePrompt("zombie fotballspiller med grønn drakt"), []);
  });

  test("blocks sexual content", () => {
    assert.ok(moderatePrompt("naken person").includes("sexual"));
  });

  test("blocks self-harm content", () => {
    assert.ok(moderatePrompt("jeg vil begå selvmord").includes("self_harm"));
  });

  test("blocks extreme violence", () => {
    assert.ok(moderatePrompt("skoleskyting outfit").includes("violence"));
  });

  test("blocks hate symbols", () => {
    assert.ok(moderatePrompt("nazi uniform med hakekors").includes("hate"));
  });

  test("blocks drug content", () => {
    assert.ok(moderatePrompt("t-skjorte med kokain").includes("drugs"));
  });

  test("does not match inside harmless words", () => {
    // «sekser», «Essex» contain 'sex' but are not standalone words.
    assert.deepEqual(moderatePrompt("en sekser på terningen fra Essex"), []);
  });

  test("evaluatePrompt maps moderation hits to SAFETY_BLOCKED", () => {
    const err = expectSafetyError(() => evaluatePrompt("naken zombie"), "SAFETY_BLOCKED");
    assert.ok(err.categories.includes("sexual"));
  });
});

describe("IP protection", () => {
  test("rewrites Spider-Man into an original safe alternative", () => {
    const result = applyIpProtection("lag meg nøyaktig Spider-Man");
    assert.equal(result.rewritten, true);
    assert.doesNotMatch(result.safePrompt, /spider[\s-]?man/i);
    assert.match(result.safePrompt, /red-and-blue/i);
    assert.match(result.safePrompt, /web-inspired/i);
    assert.doesNotMatch(result.safePrompt, /nøyaktig/i);
  });

  test("rewrites other protected characters", () => {
    for (const name of ["batman", "Elsa", "pikachu", "Harry Potter", "sonic"]) {
      const result = applyIpProtection(`lag ${name} skin`);
      assert.equal(result.rewritten, true, `${name} should be rewritten`);
      assert.ok(result.categories.includes("protected_character"));
    }
  });

  test("leaves original ideas untouched", () => {
    const result = applyIpProtection("en blå drage med gullvinger");
    assert.equal(result.rewritten, false);
    assert.equal(result.safePrompt, "en blå drage med gullvinger");
  });

  test("blocks brand logo requests with IP_RESTRICTED", () => {
    expectSafetyError(() => applyIpProtection("hoodie med Nike-logo"), "IP_RESTRICTED");
    expectSafetyError(() => applyIpProtection("adidas bukse"), "IP_RESTRICTED");
  });

  test("evaluatePrompt marks rewritten prompts as allowed_rewritten", () => {
    const decision = evaluatePrompt("Spider-Man genser");
    assert.equal(decision.decision, "allowed_rewritten");
    assert.notEqual(decision.promptHash, decision.safePromptHash);
  });
});

describe("rate limiting", () => {
  test("allows up to the limit then blocks with RATE_LIMITED", () => {
    let now = 0;
    const limiter = new RateLimiter(3, 1000, () => now);
    limiter.check("ip1");
    limiter.check("ip1");
    limiter.check("ip1");
    const err = expectSafetyError(() => limiter.check("ip1"), "RATE_LIMITED");
    assert.equal(err.httpStatus, 429);
    assert.equal(err.retryable, true);
  });

  test("window slides — old hits expire", () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1000, () => now);
    limiter.check("ip1");
    limiter.check("ip1");
    now = 1500;
    limiter.check("ip1"); // does not throw
  });

  test("keys are independent", () => {
    const limiter = new RateLimiter(1, 1000, () => 0);
    limiter.check("a");
    limiter.check("b"); // does not throw
  });
});

describe("decision registry & hashing", () => {
  test("hash is stable and normalized", () => {
    assert.equal(hashPrompt("  Drage  "), hashPrompt("drage"));
    assert.equal(hashPrompt("drage").length, 64);
  });

  test("recorded decisions can be looked up by safe prompt text", () => {
    const decision = evaluatePrompt("lag Batman kul");
    recordDecision(decision);
    const found = lookupDecision(decision.safePrompt);
    assert.equal(found?.decision, "allowed_rewritten");
    assert.equal(found?.promptHash, decision.promptHash);
  });

  test("evaluatePrompt never returns the raw prompt when rewritten", () => {
    const decision = evaluatePrompt("Pikachu på brystet");
    assert.doesNotMatch(decision.safePrompt, /pikachu/i);
  });
});

describe("output moderation (generated images)", () => {
  test("safe verdict is allowed", () => {
    const outcome = parseImageSafetyVerdict('{"safe": true, "categories": []}');
    assert.equal(outcome.flagged, false);
    assert.deepEqual(outcome.categories, []);
    assertImageAllowed(outcome); // does not throw
  });

  test("unsafe verdict throws SAFETY_BLOCKED at output_moderation with categories", () => {
    const outcome = parseImageSafetyVerdict('{"safe": false, "categories": ["violence", "hate"]}');
    assert.equal(outcome.flagged, true);
    const err = expectSafetyError(() => assertImageAllowed(outcome), "SAFETY_BLOCKED");
    assert.equal(err.stage, "output_moderation");
    assert.deepEqual(err.categories.sort(), ["hate", "violence"]);
    assert.match(err.message, /Prøv en annen idé/);
  });

  test("unsafe verdict with no categories still blocks (categories: [flagged])", () => {
    const outcome = parseImageSafetyVerdict('{"safe": false, "categories": []}');
    const err = expectSafetyError(() => assertImageAllowed(outcome), "SAFETY_BLOCKED");
    assert.deepEqual(err.categories, ["flagged"]);
  });

  test("unknown category names are dropped, verdict still applies", () => {
    const outcome = parseImageSafetyVerdict('{"safe": false, "categories": ["violence", "weird-stuff"]}');
    assert.deepEqual(outcome.categories, ["violence"]);
  });

  test("verdict wrapped in prose/markdown is still parsed", () => {
    const outcome = parseImageSafetyVerdict('Here you go:\n```json\n{"safe": true, "categories": []}\n```');
    assert.equal(outcome.flagged, false);
  });

  test("unparseable verdicts throw (caller fails closed, image is not served)", () => {
    assert.throws(() => parseImageSafetyVerdict(""), SyntaxError);
    assert.throws(() => parseImageSafetyVerdict("the image looks fine"), SyntaxError);
    assert.throws(() => parseImageSafetyVerdict('{"categories": []}'), SyntaxError);
    assert.throws(() => parseImageSafetyVerdict('{"safe": "yes"}'), SyntaxError);
  });

  test("hashImage is stable sha256 of the base64 payload", () => {
    assert.equal(hashImage("abc"), hashImage("abc"));
    assert.notEqual(hashImage("abc"), hashImage("abd"));
    assert.equal(hashImage("abc").length, 64);
  });
});
