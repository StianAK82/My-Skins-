import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function PaymentSuccess() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-semibold">Payment successful</h1>
        <p className="text-muted-foreground">Your credit purchase was completed. You can return to the editor and upload to Roblox.</p>
        <div className="flex justify-center gap-2">
          <Link href="/projects"><Button variant="outline">Go to Projects</Button></Link>
          <Link href="/dashboard"><Button>Go to Dashboard</Button></Link>
        </div>
      </div>
    </div>
  );
}
