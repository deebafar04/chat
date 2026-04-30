import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import {
    MessageSquare,
    Code2,
    FileText,
    GitBranch,
    Palette,
    Wrench,
    Sparkles,
    Zap,
    Brain,
    Settings,
    Search,
    Globe,
    Terminal
} from "lucide-react";

export default function AgentsPage() {
    const agents = [
        {
            id: "chat-model",
            name: "Chat Model Agent",
            icon: MessageSquare,
            description: "The core conversational AI that powers natural language understanding and generation.",
            gradient: "from-blue-500 to-cyan-500",
            features: [
                "Natural language processing",
                "Context-aware responses",
                "Multi-turn conversations",
                "Streaming responses"
            ],
            tools: [
                "Text generation",
                "Question answering",
                "Summarization",
                "Translation",
                "Creative writing",
                "Code explanation"
            ]
        },
        {
            id: "python",
            name: "Python Execution Agent",
            icon: Code2,
            description: "Execute Python code securely in a sandboxed environment for data analysis and automation.",
            gradient: "from-green-500 to-emerald-500",
            features: [
                "Secure code execution",
                "Data analysis with pandas",
                "Visualization with matplotlib",
                "NumPy computations",
                "File I/O operations",
                "Package management"
            ],
            tools: [
                "Code interpreter",
                "Data processing",
                "Mathematical calculations",
                "Chart generation",
                "CSV/JSON parsing",
                "Algorithm testing"
            ]
        },
        {
            id: "document",
            name: "Document Processing Agent",
            icon: FileText,
            description: "Analyze, extract, and process information from various document formats.",
            gradient: "from-purple-500 to-pink-500",
            features: [
                "PDF text extraction",
                "Document summarization",
                "Key information extraction",
                "Multi-format support",
                "OCR capabilities"
            ],
            tools: [
                "PDF reader",
                "Text extractor",
                "Document analyzer",
                "Content summarizer"
            ]
        },
        {
            id: "git-mcp",
            name: "Git MCP Agent",
            icon: GitBranch,
            description: "Manage Git repositories and automate version control workflows through natural language.",
            gradient: "from-orange-500 to-red-500",
            features: [
                "Repository management",
                "Commit history analysis",
                "Branch operations",
                "Code review assistance",
                "Merge conflict resolution",
                "CI/CD integration"
            ],
            tools: [
                "Git commands",
                "Diff viewer",
                "Commit analyzer",
                "Branch manager",
                "Pull request helper",
                "Repository stats"
            ]
        },
        {
            id: "mermaid",
            name: "Mermaid Diagram Agent",
            icon: Palette,
            description: "Generate beautiful diagrams, flowcharts, and visualizations from text descriptions.",
            gradient: "from-indigo-500 to-purple-500",
            features: [
                "Flowchart generation",
                "Sequence diagrams",
                "Class diagrams",
                "State diagrams",
                "Gantt charts",
                "ER diagrams"
            ],
            tools: [
                "Diagram generator",
                "Syntax validator",
                "Style customizer",
                "Export to SVG/PNG",
                "Template library",
                "Real-time preview"
            ]
        },
        {
            id: "provider-tools",
            name: "Provider Tools Agent",
            icon: Wrench,
            description: "Access web search, remote code execution, and URL context from multiple AI providers.",
            gradient: "from-yellow-500 to-orange-500",
            features: [
                "Multi-provider support",
                "Tool orchestration",
                "Web search integration",
                "Remote code execution",
                "URL context extraction"
            ],
            tools: [
                "Web search",
                "Code execution",
                "URL reader",
                "Context extractor",
                "Provider selector"
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-background">
            {/* Hero Section */}
            <section className="px-4 pt-4 pb-8">
                <div className="container mx-auto text-center">
                    <div className="animate-fade-in-up">
                        <h1 className="mb-6 font-bold text-5xl md:text-7xl bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                            Meet Our AI Agents
                        </h1>
                        <p className="mb-6 mx-auto max-w-3xl text-muted-foreground text-xl leading-relaxed">
                            Each agent is specialized for specific tasks, working together to provide
                            you with a comprehensive AI-powered experience.
                        </p>
                        <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500/10 to-pink-500/10 px-4 py-2 border border-purple-500/20">
                            <Sparkles className="h-4 w-4 text-purple-600" />
                            <Link href="/keys" className="text-sm font-medium text-purple-600">Model Key Setup</Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Agents Grid */}
            <section className="px-4 py-8">
                <div className="container mx-auto">
                    <div className="grid gap-12 lg:gap-16">
                        {agents.map((agent, index) => {
                            const Icon = agent.icon;
                            const isEven = index % 2 === 0;

                            return (
                                <div
                                    key={agent.id}
                                    className="agent-card group relative"
                                    style={{
                                        animationDelay: `${index * 150}ms`,
                                    }}
                                >
                                    <div className={`grid gap-8 lg:grid-cols-2 items-center ${!isEven ? 'lg:grid-flow-dense' : ''}`}>
                                        {/* Agent Info */}
                                        <div className={`${!isEven ? 'lg:col-start-2' : ''}`}>
                                            <div className={`mb-4 inline-flex p-4 rounded-2xl bg-gradient-to-br ${agent.gradient}`}>
                                                <Icon className="h-8 w-8 text-white" />
                                            </div>
                                            <h2 className="mb-4 font-bold text-3xl md:text-4xl">
                                                {agent.name}
                                            </h2>
                                            <p className="mb-6 text-muted-foreground text-lg leading-relaxed">
                                                {agent.description}
                                            </p>
                                            <Button asChild size="lg" className={`bg-gradient-to-r ${agent.gradient} text-white hover:opacity-90 transition-opacity`}>
                                                <Link href="/register">Get Started</Link>
                                            </Button>
                                        </div>

                                        {/* Features & Tools */}
                                        <div className={`${!isEven ? 'lg:col-start-1 lg:row-start-1' : ''}`}>
                                            <div className="space-y-6">
                                                {/* Features */}
                                                <div className="rounded-2xl border bg-card p-6 hover:shadow-lg transition-shadow">
                                                    <div className="mb-4 flex items-center gap-2">
                                                        <Brain className="h-5 w-5 text-purple-600" />
                                                        <h3 className="font-semibold text-lg">Key Features</h3>
                                                    </div>
                                                    <ul className="grid gap-2 sm:grid-cols-2">
                                                        {agent.features.map((feature, i) => (
                                                            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                                                <Zap className="h-4 w-4 mt-0.5 text-purple-600 flex-shrink-0" />
                                                                <span>{feature}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>

                                                {/* Tools */}
                                                <div className="rounded-2xl border bg-card p-6 hover:shadow-lg transition-shadow">
                                                    <div className="mb-4 flex items-center gap-2">
                                                        <Settings className="h-5 w-5 text-blue-600" />
                                                        <h3 className="font-semibold text-lg">Available Tools</h3>
                                                    </div>
                                                    <ul className="grid gap-2 sm:grid-cols-2">
                                                        {agent.tools.map((tool, i) => (
                                                            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                                                <Wrench className="h-4 w-4 mt-0.5 text-blue-600 flex-shrink-0" />
                                                                <span>{tool}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Decorative gradient */}
                                    <div className={`absolute -z-10 top-1/2 ${isEven ? 'left-0' : 'right-0'} h-96 w-96 -translate-y-1/2 rounded-full bg-gradient-to-br ${agent.gradient} opacity-5 blur-3xl group-hover:opacity-10 transition-opacity duration-500`} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Integration Section */}
            <section className="px-4 py-20">
                <div className="container mx-auto">
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 p-12 text-center text-white">
                        <div className="absolute inset-0 bg-grid-white/10" />
                        <div className="relative z-10">
                            <Globe className="mx-auto mb-6 h-16 w-16" />
                            <h2 className="mb-4 font-bold text-4xl">Seamless Integration</h2>
                            <p className="mx-auto mb-8 max-w-2xl text-lg text-white/90">
                                All agents work together seamlessly, sharing context and collaborating
                                to provide you with the most comprehensive AI experience.
                            </p>
                            <div className="flex justify-center gap-4">
                                <Button asChild size="lg" variant="secondary">
                                    <Link href="/register">Start Free</Link>
                                </Button>
                                <Button asChild size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-purple-600">
                                    <Link href="/features">View Features</Link>
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
