import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function PaymentCancelled() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-semibold">Payment cancelled</h1>
        <p className="text-muted-foreground">No charge was made. You can try again anytime.</p>
        <div className="flex justify-center gap-2">
          <Link href="/dashboard"><Button variant="outline">Back to Dashboard</Button></Link>
          <Link href="/projects"><Button>Open Projects</Button></Link>
        </div>
      </div>
    </div>
  );
}
