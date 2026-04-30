import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import {
    Sparkles,
    Zap,
    Shield,
    Code,
    FileText,
    GitBranch,
    Palette,
    Terminal,
    Lock,
    Cloud,
    Rocket,
    Users,
    MessageSquare,
    Database,
    Image,
    ArrowRight,
    CheckCircle2
} from "lucide-react";

export default function FeaturesPage() {
    const mainFeatures = [
        {
            icon: MessageSquare,
            title: "Flexible AI Integrations",
            description: "Engage with cutting-edge language models including GPT-4, Claude, and Gemini. Experience natural, context-aware conversations that understand nuance and maintain coherent dialogue across multiple turns.",
            gradient: "from-purple-500 to-pink-500",
            highlights: [
                "Multi-turn context retention",
                "Natural language understanding",
                "Streaming responses for real-time interaction",
                "Support for multiple AI providers",
                "Customizable conversation settings"
            ]
        },
        {
            icon: Code,
            title: "Python Code Execution",
            description: "Execute Python code securely in a sandboxed environment. Perfect for data analysis, mathematical computations, algorithm testing, and automation tasks.",
            gradient: "from-blue-500 to-cyan-500",
            highlights: [
                "Secure sandboxed execution",
                "Data analysis with pandas & numpy",
                "Visualization with matplotlib",
                "File I/O operations",
                "Real-time code output"
            ]
        },
        {
            icon: FileText,
            title: "Document Intelligence",
            description: "Upload and analyze documents with AI-powered insights. Extract information, summarize content, and get answers from your PDFs, text files, and more.",
            gradient: "from-green-500 to-emerald-500",
            highlights: [
                "PDF text extraction",
                "Multi-format document support",
                "Intelligent summarization",
                "Key information extraction",
                "Question answering from documents"
            ]
        }
    ];

    const additionalFeatures = [
        {
            icon: GitBranch,
            title: "Git Integration",
            description: "Manage repositories and automate version control workflows through natural language.",
            gradient: "from-orange-500 to-red-500",
        },
        {
            icon: Palette,
            title: "Mermaid Diagrams",
            description: "Generate beautiful diagrams, flowcharts, and visualizations from text descriptions.",
            gradient: "from-indigo-500 to-purple-500",
        },
        {
            icon: Terminal,
            title: "Provider Tools",
            description: "Access web search, remote code execution, and URL context from multiple AI providers.",
            gradient: "from-yellow-500 to-orange-500",
        },
        {
            icon: Shield,
            title: "Enterprise Security",
            description: "Bank-level encryption and security measures to protect your data and conversations.",
            gradient: "from-red-500 to-pink-500",
        },
        {
            icon: Zap,
            title: "Lightning Fast",
            description: "Optimized for speed with instant responses and real-time streaming.",
            gradient: "from-cyan-500 to-blue-500",
        },
        {
            icon: Lock,
            title: "Privacy First",
            description: "Your data stays yours. We never train on your conversations or share your information.",
            gradient: "from-pink-500 to-rose-500",
        },
        {
            icon: Cloud,
            title: "Cloud Sync",
            description: "Access your conversations from anywhere with seamless cloud synchronization.",
            gradient: "from-teal-500 to-green-500",
        },
        {
            icon: Rocket,
            title: "Continuous Updates",
            description: "Regular feature updates and improvements to enhance your experience.",
            gradient: "from-violet-500 to-purple-500",
        },
        {
            icon: Users,
            title: "Multi-User Support",
            description: "Collaborate with team members and share conversations securely.",
            gradient: "from-amber-500 to-yellow-500",
        },
    ];

    const upcomingFeatures = [
        {
            icon: Image,
            title: "Image Generation",
            description: "Create stunning images from text descriptions using state-of-the-art AI models.",
            gradient: "from-purple-500 to-pink-500",
            status: "Coming Soon"
        }
    ];

    return (
        <div className="min-h-screen bg-background">
            {/* Hero Section */}
            <section className="px-4 pt-4 pb-8">
                <div className="container mx-auto text-center">
                    <div className="animate-fade-in-up">
                        <h1 className="mb-6 font-bold text-5xl md:text-7xl bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                            Core Features
                        </h1>
                        <p className="mx-auto max-w-3xl text-muted-foreground text-xl leading-relaxed">
                            Discover the comprehensive suite of AI-powered tools and capabilities
                            designed to supercharge your productivity and creativity.
                        </p>
                    </div>
                </div>
            </section>

            {/* Main Features - Prominent Section */}
            <section className="px-4 py-16">
                <div className="container mx-auto">
                    <div className="space-y-16">
                        {mainFeatures.map((feature, index) => {
                            const Icon = feature.icon;
                            const isEven = index % 2 === 0;

                            return (
                                <div
                                    key={index}
                                    className="feature-card group relative"
                                    style={{
                                        animationDelay: `${index * 150}ms`,
                                    }}
                                >
                                    <div className={`grid gap-8 lg:grid-cols-2 items-center ${!isEven ? 'lg:grid-flow-dense' : ''}`}>
                                        {/* Feature Info */}
                                        <div className={`${!isEven ? 'lg:col-start-2' : ''}`}>
                                            <div className={`mb-6 inline-flex p-4 rounded-2xl bg-gradient-to-br ${feature.gradient}`}>
                                                <Icon className="h-10 w-10 text-white" />
                                            </div>
                                            <h3 className="mb-4 font-bold text-3xl md:text-4xl">
                                                {feature.title}
                                            </h3>
                                            <p className="mb-6 text-muted-foreground text-lg leading-relaxed">
                                                {feature.description}
                                            </p>
                                            <Button asChild size="lg" className={`bg-gradient-to-r ${feature.gradient} text-white hover:opacity-90 transition-opacity`}>
                                                <Link href="/register">
                                                    Get Started
                                                    <ArrowRight className="ml-2 h-5 w-5" />
                                                </Link>
                                            </Button>
                                        </div>

                                        {/* Highlights */}
                                        <div className={`${!isEven ? 'lg:col-start-1 lg:row-start-1' : ''}`}>
                                            <div className="rounded-2xl border bg-card p-8 hover:shadow-xl transition-shadow">
                                                <h4 className="mb-6 font-semibold text-xl">Key Highlights</h4>
                                                <ul className="space-y-4">
                                                    {feature.highlights.map((highlight, i) => (
                                                        <li key={i} className="flex items-start gap-3">
                                                            <CheckCircle2 className="h-6 w-6 mt-0.5 flex-shrink-0 text-purple-600" />
                                                            <span className="text-muted-foreground leading-relaxed">{highlight}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Decorative gradient */}
                                    <div className={`absolute -z-10 top-1/2 ${isEven ? 'left-0' : 'right-0'} h-96 w-96 -translate-y-1/2 rounded-full bg-gradient-to-br ${feature.gradient} opacity-5 blur-3xl group-hover:opacity-10 transition-opacity duration-500`} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Additional Features Grid */}
            <section className="px-4 py-20 bg-muted/50">
                <div className="container mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="mb-4 font-bold text-4xl bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                            Additional Features
                        </h2>
                        <p className="mx-auto max-w-2xl text-muted-foreground text-lg">
                            Even more tools to enhance your workflow
                        </p>
                    </div>

                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {additionalFeatures.map((feature, index) => {
                            const Icon = feature.icon;
                            return (
                                <div
                                    key={index}
                                    className="group feature-card relative overflow-hidden rounded-2xl border bg-card p-8 transition-all duration-300 hover:shadow-2xl hover:scale-105"
                                    style={{
                                        animationDelay: `${index * 100}ms`,
                                    }}
                                >
                                    {/* Gradient background on hover */}
                                    <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />

                                    {/* Icon */}
                                    <div className={`mb-4 inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.gradient}`}>
                                        <Icon className="h-6 w-6 text-white" />
                                    </div>

                                    {/* Content */}
                                    <h3 className="mb-3 font-semibold text-xl group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:bg-clip-text group-hover:from-purple-600 group-hover:to-pink-600 transition-all">
                                        {feature.title}
                                    </h3>
                                    <p className="text-muted-foreground leading-relaxed">
                                        {feature.description}
                                    </p>

                                    {/* Decorative element */}
                                    <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-gradient-to-br from-purple-500/10 to-pink-500/10 blur-2xl group-hover:scale-150 transition-transform duration-500" />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Upcoming Features */}
            <section className="px-4 py-20">
                <div className="container mx-auto">
                    <div className="max-w-2xl mx-auto">
                        {upcomingFeatures.map((feature, index) => {
                            const Icon = feature.icon;
                            return (
                                <div
                                    key={index}
                                    className="group relative overflow-hidden rounded-3xl border-2 border-dashed bg-card p-12 transition-all duration-300 hover:shadow-2xl hover:border-solid"
                                >
                                    <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-5 group-hover:opacity-10 transition-opacity duration-300`} />

                                    <div className="relative z-10 text-center">
                                        <div className={`mb-6 inline-flex p-4 rounded-2xl bg-gradient-to-br ${feature.gradient}`}>
                                            <Icon className="h-12 w-12 text-white" />
                                        </div>

                                        <div className="mb-3 inline-block px-4 py-1 rounded-full bg-purple-500/10 text-purple-600 text-sm font-semibold">
                                            {feature.status}
                                        </div>

                                        <h3 className="mb-4 font-bold text-3xl">
                                            {feature.title}
                                        </h3>
                                        <p className="text-muted-foreground text-lg leading-relaxed">
                                            {feature.description}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="px-4 py-20">
                <div className="container mx-auto">
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 p-12 text-center text-white">
                        <div className="absolute inset-0 bg-grid-white/10" />
                        <div className="relative z-10">
                            <h2 className="mb-4 font-bold text-4xl">Ready to Get Started?</h2>
                            <p className="mx-auto mb-8 max-w-2xl text-lg text-white/90">
                                Join thousands of users already experiencing the future of AI-powered conversations.
                            </p>
                            <div className="flex justify-center gap-4">
                                <Button asChild size="lg" variant="secondary">
                                    <Link href="/chat">Start Chat</Link>
                                </Button>
                                <Button asChild size="lg" className="bg-white text-purple-600 hover:bg-white/90">
                                    <Link href="/agents">Explore Agents</Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <SiteFooter />
        </div>
    );
}
