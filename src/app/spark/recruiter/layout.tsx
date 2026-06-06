import type { ReactNode } from "react";
import { getSparkRecruiterUser } from "@/lib/spark-auth";
import { SparkRecruiterNav } from "@/components/spark/SparkRecruiterNav";

export default async function RecruiterLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getSparkRecruiterUser();
  return (
    <>
      <SparkRecruiterNav email={user?.email ?? null} />
      {children}
    </>
  );
}
