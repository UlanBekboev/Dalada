-- CreateTable
CREATE TABLE "public"."CandidateFavoriteVacancy" (
    "id" TEXT NOT NULL,
    "vacancyId" TEXT NOT NULL,
    "candidateUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateFavoriteVacancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmployerFavoriteCandidate" (
    "id" TEXT NOT NULL,
    "vacancyId" TEXT NOT NULL,
    "candidateUserId" TEXT NOT NULL,
    "employerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployerFavoriteCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CandidateFavoriteVacancy_vacancyId_candidateUserId_key" ON "public"."CandidateFavoriteVacancy"("vacancyId", "candidateUserId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployerFavoriteCandidate_vacancyId_candidateUserId_key" ON "public"."EmployerFavoriteCandidate"("vacancyId", "candidateUserId");

-- AddForeignKey
ALTER TABLE "public"."CandidateFavoriteVacancy" ADD CONSTRAINT "CandidateFavoriteVacancy_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "public"."Vacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CandidateFavoriteVacancy" ADD CONSTRAINT "CandidateFavoriteVacancy_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmployerFavoriteCandidate" ADD CONSTRAINT "EmployerFavoriteCandidate_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "public"."Vacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmployerFavoriteCandidate" ADD CONSTRAINT "EmployerFavoriteCandidate_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmployerFavoriteCandidate" ADD CONSTRAINT "EmployerFavoriteCandidate_employerUserId_fkey" FOREIGN KEY ("employerUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
