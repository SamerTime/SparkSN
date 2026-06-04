"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { AlertCircle, ArrowRight, Clock, Home } from "lucide-react";

export default function NotFound() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const redirectTimer = setTimeout(() => {
      router.push("/jobs");
    }, 5000);

    return () => {
      clearInterval(timer);
      clearTimeout(redirectTimer);
    };
  }, [router]);

  return (
    <div className="sn-page flex items-center justify-center p-4">
      <Card className="w-full max-w-md overflow-hidden rounded-lg border border-[var(--sn-line)] shadow-sm">
        <div className="bg-[var(--sn-coral)] p-1"></div>

        <CardContent className="p-6">
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <div className="flex justify-center">
                <div className="rounded-lg bg-[var(--sn-blue-50)] p-4">
                  <AlertCircle className="h-12 w-12 text-[var(--sn-blue)]" />
                </div>
              </div>
              <h1 className="text-4xl font-extrabold text-[var(--sn-ink)]">404</h1>
              <h2 className="text-2xl font-extrabold text-[var(--sn-ink-2)]">
                Page Not Found
              </h2>
            </div>

            <p className="rounded-lg border border-[var(--sn-line)] bg-white p-4 text-sm text-[var(--sn-muted)]">
              The page you&apos;re looking for doesn&apos;t exist or has been
              moved.
            </p>

            <div className="flex items-center justify-center gap-2 text-[var(--sn-muted)]">
              <Clock className="h-5 w-5" />
              <p className="text-sm">
                Redirecting in{" "}
                <span className="font-bold text-[var(--sn-blue-700)]">{countdown}</span>{" "}
                seconds...
              </p>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 px-6 pb-6">
          <Button
            onClick={() => {
              router.push("/jobs");
            }}
            className="sn-button-primary w-full"
          >
            Go to jobs
            <Home className="ml-2 h-4 w-4" />
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
