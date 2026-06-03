-- CreateEnum
CREATE TYPE "public"."SparkPostingStatus" AS ENUM ('Published', 'Archived', 'Closed');

-- CreateEnum
CREATE TYPE "public"."SparkApplicationStatus" AS ENUM (
  'ProfileStarted',
  'Applied',
  'RecruiterApproved',
  'InterviewInvited',
  'InterviewStarted',
  'InterviewCompleted',
  'RecruiterReview',
  'Vetted',
  'Declined'
);

-- CreateTable
CREATE TABLE "public"."SparkJobPosting" (
  "id" TEXT NOT NULL,
  "sourceSystem" TEXT NOT NULL DEFAULT 'staffingnation',
  "sourceEntityType" TEXT NOT NULL DEFAULT 'job_description',
  "sourceEntityId" TEXT NOT NULL,
  "sourceRevision" TEXT,
  "payloadVersion" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "clientName" TEXT,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "overview" TEXT,
  "responsibilities" TEXT,
  "requirements" TEXT,
  "qualifications" TEXT,
  "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "certifications" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "physicalRequirements" JSONB NOT NULL DEFAULT '{}',
  "payRangeMin" DECIMAL(65,30),
  "payRangeMax" DECIMAL(65,30),
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "country" JSONB,
  "socCode" TEXT,
  "socTitle" TEXT,
  "wcCode" TEXT,
  "wcDescription" TEXT,
  "publicJobsBaseUrl" TEXT NOT NULL DEFAULT 'https://tcwtable.com/jobs',
  "publicUrl" TEXT,
  "status" "public"."SparkPostingStatus" NOT NULL DEFAULT 'Published',
  "rawPayload" JSONB NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SparkJobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SparkCandidateProfile" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "firstName" TEXT,
  "lastName" TEXT,
  "phone" TEXT,
  "city" TEXT,
  "state" TEXT,
  "country" TEXT,
  "resumeUrl" TEXT,
  "profileData" JSONB NOT NULL DEFAULT '{}',
  "geolocationConsentAt" TIMESTAMP(3),
  "aiInterviewConsentAt" TIMESTAMP(3),
  "recordingConsentAt" TIMESTAMP(3),
  "fraudReviewData" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SparkCandidateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SparkApplication" (
  "id" TEXT NOT NULL,
  "postingId" TEXT NOT NULL,
  "candidateId" TEXT,
  "candidateEmail" TEXT,
  "candidateName" TEXT,
  "candidatePhone" TEXT,
  "status" "public"."SparkApplicationStatus" NOT NULL DEFAULT 'ProfileStarted',
  "recruiterNotes" TEXT,
  "communicationState" JSONB NOT NULL DEFAULT '{}',
  "deviceSignals" JSONB NOT NULL DEFAULT '{}',
  "locationSignals" JSONB NOT NULL DEFAULT '{}',
  "interviewMedia" JSONB NOT NULL DEFAULT '{}',
  "interviewTranscript" JSONB NOT NULL DEFAULT '{}',
  "aiSummary" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SparkApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SparkJobPosting_sourceEntityId_key" ON "public"."SparkJobPosting"("sourceEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "SparkJobPosting_slug_key" ON "public"."SparkJobPosting"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SparkCandidateProfile_email_key" ON "public"."SparkCandidateProfile"("email");

-- CreateIndex
CREATE INDEX "SparkApplication_postingId_status_idx" ON "public"."SparkApplication"("postingId", "status");

-- CreateIndex
CREATE INDEX "SparkApplication_candidateEmail_idx" ON "public"."SparkApplication"("candidateEmail");

-- AddForeignKey
ALTER TABLE "public"."SparkApplication"
  ADD CONSTRAINT "SparkApplication_postingId_fkey"
  FOREIGN KEY ("postingId") REFERENCES "public"."SparkJobPosting"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SparkApplication"
  ADD CONSTRAINT "SparkApplication_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "public"."SparkCandidateProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
