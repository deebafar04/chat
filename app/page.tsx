import { LandingPage } from "@/components/landing-page";
import { PublicLayout } from "@/components/public-layout";

export default async function RootPage() {
  return (
    <PublicLayout>
      <LandingPage />
    </PublicLayout>
  );
}
