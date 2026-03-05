import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Zap,
  Shield,
  ArrowRight,
  CheckCircle2,
  Star,
  TrendingUp,
  Users,
  Globe,
  Lock
} from "lucide-react";

export default async function LandingPage() {
  // Check if user is authenticated
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If user is authenticated, redirect to chat
  if (user) {
    redirect("/chat");
  }

  // Show landing page for unauthenticated users
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Floating Navigation */}
      <nav className="fixed top-0 right-0 left-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="font-bold text-xl bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            AI Chatbot
          </div>
          <div className="flex gap-2">
            <Button asChild variant="ghost">
              <Link href="/">Home</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/features">Features</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/agents">Agents</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/faq">FAQ</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild className="bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90">
              <Link href="/register">Sign Up</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section with Animated Background */}
      <section className="relative px-4 pt-32 pb-24 overflow-hidden">
        {/* Animated gradient orbs */}
        <div className="absolute top-20 left-10 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl animate-pulse" />
        <div className="absolute top-40 right-10 h-96 w-96 rounded-full bg-pink-500/20 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-20 left-1/2 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />

        <div className="container mx-auto text-center relative z-10">
          <div className="animate-fade-in-up">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500/10 to-pink-500/10 px-4 py-2 border border-purple-500/20 backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-purple-600 animate-pulse" />
              <span className="text-sm font-medium text-purple-600">Powered by Advanced AI</span>
            </div>

            {/* Main Heading */}
            <h1 className="mb-6 font-bold text-6xl md:text-8xl bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent leading-tight">
              AI-Powered Chat
              <br />
              Experience
            </h1>

            {/* Subheading */}
            <p className="mx-auto mb-8 max-w-3xl text-muted-foreground text-xl md:text-2xl leading-relaxed">
              Experience the future of conversation with our advanced AI chatbot.
              Get instant answers, creative assistance, and intelligent
              conversations—completely <span className="font-semibold text-green-600">free</span>.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap justify-center gap-4 mb-12">
              <Button asChild size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-lg px-8 py-6 group">
                <Link href="/register">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-lg px-8 py-6 border-2">
                <Link href="/agents">Explore Agents</Link>
              </Button>
            </div>

            {/* Social Proof */}
            <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span>Free forever</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span>6 specialized AI agents</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-20" id="features">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="mb-4 font-bold text-4xl md:text-5xl bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Powerful Features
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground text-lg">
              Everything you need for an exceptional AI experience
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="feature-card group relative overflow-hidden rounded-2xl border bg-card p-8 hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-10 transition-opacity" />
              <div className="relative z-10">
                <div className="mb-4 inline-flex p-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-3 font-semibold text-2xl">
                  Intelligent Conversations
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Engage in natural, context-aware conversations with our advanced
                  AI powered by the latest language models.
                </p>
                <Link href="/features" className="text-blue-600 hover:underline inline-flex items-center gap-1 group/link">
                  Learn more
                  <ArrowRight className="h-4 w-4 group-hover/link:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            <div className="feature-card group relative overflow-hidden rounded-2xl border bg-card p-8 hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 opacity-0 group-hover:opacity-10 transition-opacity" />
              <div className="relative z-10">
                <div className="mb-4 inline-flex p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-3 font-semibold text-2xl">
                  6 Specialized Agents
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  From code execution to document processing, our AI agents
                  handle diverse tasks with expertise.
                </p>
                <Link href="/agents" className="text-purple-600 hover:underline inline-flex items-center gap-1 group/link">
                  Explore agents
                  <ArrowRight className="h-4 w-4 group-hover/link:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            <div className="feature-card group relative overflow-hidden rounded-2xl border bg-card p-8 hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 opacity-0 group-hover:opacity-10 transition-opacity" />
              <div className="relative z-10">
                <div className="mb-4 inline-flex p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-3 font-semibold text-2xl">
                  Secure & Private
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Your conversations are protected with enterprise-grade security
                  and encryption. Your data stays yours.
                </p>
                <Link href="/faq" className="text-green-600 hover:underline inline-flex items-center gap-1 group/link">
                  Security details
                  <ArrowRight className="h-4 w-4 group-hover/link:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Free Section */}
      <section className="px-4 py-20 bg-muted/50">
        <div className="container mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 p-12 md:p-16 text-white">
            <div className="absolute inset-0 bg-grid-white/10" />
            <div className="relative z-10 max-w-3xl mx-auto text-center">
              <Globe className="mx-auto mb-6 h-16 w-16" />
              <h2 className="mb-6 font-bold text-4xl md:text-5xl">Why It's Free</h2>
              <p className="mb-8 text-lg md:text-xl text-white/90 leading-relaxed">
                We believe AI should be accessible to everyone. By using your own API keys,
                you pay AI providers directly at their cost—no markups, no subscriptions,
                no hidden fees. Just pure, transparent AI power.
              </p>
              <div className="grid gap-6 md:grid-cols-3 text-left">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 mt-1 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-lg mb-1">No Subscription</div>
                    <div className="text-white/80">Use forever, completely free</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 mt-1 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-lg mb-1">Your API Keys</div>
                    <div className="text-white/80">Pay providers directly, no markup</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 mt-1 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-lg mb-1">Full Control</div>
                    <div className="text-white/80">Choose your providers and models</div>
                  </div>
                </div>
              </div>
              <div className="mt-8">
                <Button asChild size="lg" variant="secondary" className="text-lg px-8">
                  <Link href="/faq">Learn More</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 py-20">
        <div className="container mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 p-12 md:p-16 text-center text-white">
            <div className="absolute inset-0 bg-grid-white/10" />
            <div className="relative z-10">
              <Lock className="mx-auto mb-6 h-16 w-16" />
              <h2 className="mb-4 font-bold text-4xl md:text-5xl">Ready to Get Started?</h2>
              <p className="mx-auto mb-8 max-w-2xl text-lg md:text-xl text-white/90">
                Join thousands of users already experiencing the future of AI-powered conversations.
                No credit card required. Start chatting in minutes.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button asChild size="lg" variant="secondary" className="text-lg px-8 py-6">
                  <Link href="/register">
                    Start Free Now
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-purple-600 text-lg px-8 py-6">
                  <Link href="/features">View All Features</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-4 py-12 bg-muted/30">
        <div className="container mx-auto">
          <div className="grid gap-8 md:grid-cols-4 mb-8">
            <div>
              <div className="font-bold text-xl mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                AI Chatbot
              </div>
              <p className="text-sm text-muted-foreground">
                Advanced AI-powered conversations, completely free.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/features" className="hover:text-foreground transition-colors">Features</Link></li>
                <li><Link href="/agents" className="hover:text-foreground transition-colors">Agents</Link></li>
                <li><Link href="/faq" className="hover:text-foreground transition-colors">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-foreground transition-colors">About</Link></li>
                <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Get Started</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/register" className="hover:text-foreground transition-colors">Sign Up</Link></li>
                <li><Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2026 DreamStudio Earth &ndash; CodeChat RAG addition to [Vercel Starter](https://model.earth/chat/).</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

