"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function safeReturnTo(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/spark/recruiter";
}

export function SparkRecruiterLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/spark/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          returnTo,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to log in.");
      }

      toast.success("Recruiter signed in.");
      router.replace(result.returnTo || "/spark/recruiter");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to log in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="spark-recruiter-email">Email</Label>
        <Input
          id="spark-recruiter-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          className="sn-input h-11"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="spark-recruiter-password">Password</Label>
        <Input
          id="spark-recruiter-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          className="sn-input h-11"
          required
        />
      </div>
      <Button
        type="submit"
        className="sn-button-coral h-11 w-full font-extrabold"
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogIn className="h-4 w-4" />
        )}
        Sign in
      </Button>
    </form>
  );
}
