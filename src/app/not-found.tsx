"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ArrowRight, BriefcaseBusiness, Clock, Home } from "lucide-react";

export default function NotFound() {
  const { data: session } = useSession();
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
      if (session) {
        router.push("/spark/recruiter");
      } else {
        router.push("/jobs");
      }
    }, 5000);

    return () => {
      clearInterval(timer);
      clearTimeout(redirectTimer);
    };
  }, [session, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f4ef] p-4">
      <Card className="w-full max-w-md overflow-hidden rounded-md border border-[#d8d1c6] shadow-sm">
        <div className="bg-[#176c5d] p-1"></div>

        <CardContent className="p-6">
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <div className="flex justify-center">
                <div className="rounded-full bg-[#edf5f1] p-4">
                  <AlertCircle className="h-12 w-12 text-[#176c5d]" />
                </div>
              </div>
              <h1 className="text-4xl font-bold text-gray-800">404</h1>
              <h2 className="text-2xl font-semibold text-gray-700">
                Page Not Found
              </h2>
            </div>

            <Alert variant="default" className="border-[#d8d1c6] bg-[#fdfaf4]">
              <AlertDescription className="text-[#59616b]">
                The page you&apos;re looking for doesn&apos;t exist or has been
                moved.
              </AlertDescription>
            </Alert>

            <div className="flex items-center justify-center gap-2 text-gray-500">
              <Clock className="h-5 w-5" />
              <p className="text-sm">
                Redirecting in{" "}
                <span className="font-bold text-[#176c5d]">{countdown}</span>{" "}
                seconds...
              </p>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 px-6 pb-6">
          <Button
            onClick={() => {
              if (session) {
                router.push("/spark/recruiter");
              } else {
                router.push("/jobs");
              }
            }}
            className="w-full bg-[#20282d] hover:bg-[#344047]"
          >
            {session ? (
              <>
                Go to recruiter review
                <BriefcaseBusiness className="ml-2 h-4 w-4" />
              </>
            ) : (
              <>
                Go to jobs
                <Home className="ml-2 h-4 w-4" />
              </>
            )}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
