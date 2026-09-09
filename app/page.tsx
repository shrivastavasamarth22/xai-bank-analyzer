"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	Tooltip,
	ResponsiveContainer,
	Cell,
	ReferenceLine,
} from "recharts";
import {
	UploadCloud,
	CheckCircle2,
	AlertCircle,
	Loader2,
	MessageSquare,
	X,
	Send,
} from "lucide-react";

// --- Types ---
type Driver = { feature: string; impact: number };
type CustomerResult = {
	row_id: number;
	subscription_probability: number;
	prediction: string;
	drivers: { positive: Driver[]; negative: Driver[] };
	raw_data: Record<string, any>;
};
type BackendData = { total_processed: number; results: CustomerResult[] };
type UploadState = "idle" | "loading" | "waking-server" | "success" | "error";

export default function XAIBankAnalyzer() {
	// --- State ---
	const [uploadState, setUploadState] = useState<UploadState>("idle");
	const [data, setData] = useState<BackendData | null>(null);
	const [selectedCustomer, setSelectedCustomer] =
		useState<CustomerResult | null>(null);

	// Chat State
	const [isChatOpen, setIsChatOpen] = useState(false);
	const [chatMessages, setChatMessages] = useState<
		{ role: "user" | "ai"; text: string }[]
	>([]);
	const [chatInput, setChatInput] = useState("");
	const [isChatLoading, setIsChatLoading] = useState(false);

	// --- Upload Logic & Cold Start Handling ---
	const onDrop = useCallback(async (acceptedFiles: File[]) => {
		const file = acceptedFiles[0];
		if (!file) return;

		setUploadState("loading");

		// Cold Start Timer: If Render takes > 3s, show waking message
		const coldStartTimer = setTimeout(() => {
			setUploadState("waking-server");
		}, 3000);

		const formData = new FormData();
		formData.append("file", file);

		try {
			const res = await fetch(
				"https://bank-ml-backend.onrender.com/predict-batch",
				{
					method: "POST",
					body: formData,
				},
			);

			clearTimeout(coldStartTimer);

			if (!res.ok) throw new Error("API responded with an error.");

			const responseData: BackendData = await res.json();
			setData(responseData);
			setSelectedCustomer(responseData.results[0] || null);
			setUploadState("success");
		} catch (error) {
			clearTimeout(coldStartTimer);
			console.error(error);
			setUploadState("error");
		}
	}, []);

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		accept: { "text/csv": [".csv"] },
		maxFiles: 1,
	});

	// --- Chat Logic ---
	const handleSendMessage = async () => {
		if (!chatInput.trim() || !data) return;

		const userMsg = chatInput;
		setChatMessages((prev) => [...prev, { role: "user", text: userMsg }]);
		setChatInput("");
		setIsChatLoading(true);

		// Context: Top 10 high probability leads to avoid token limits
		const topLeads = [...data.results]
			.sort((a, b) => b.subscription_probability - a.subscription_probability)
			.slice(0, 10);

		try {
			const res = await fetch("/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message: userMsg, contextData: topLeads }),
			});
			const chatRes = await res.json();
			setChatMessages((prev) => [...prev, { role: "ai", text: chatRes.reply }]);
		} catch (e) {
			setChatMessages((prev) => [
				...prev,
				{ role: "ai", text: "Error connecting to AI assistant." },
			]);
		} finally {
			setIsChatLoading(false);
		}
	};

	// --- Data Formatting for Recharts ---
	const getChartData = () => {
		if (!selectedCustomer) return [];
		const { positive, negative } = selectedCustomer.drivers;

		// Combine and sort by absolute impact
		const combined = [
			...positive.map((d) => ({
				name: d.feature,
				value: d.impact,
				type: "positive",
			})),
			...negative.map((d) => ({
				name: d.feature,
				value: d.impact,
				type: "negative",
			})),
		].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

		return combined;
	};

	// ==========================================
	// VIEW 1: THE LANDING & UPLOAD SCREEN
	// ==========================================
	if (
		uploadState === "idle" ||
		uploadState === "loading" ||
		uploadState === "waking-server" ||
		uploadState === "error"
	) {
		return (
			<div className="min-h-screen bg-canvas text-primary flex flex-col items-center justify-center p-6 relative overflow-hidden">
				{/* Subtle Background Glow */}
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-electric opacity-[0.03] blur-[120px] rounded-full pointer-events-none" />

				<div className="max-w-2xl text-center space-y-6 z-10">
					<h1 className="text-5xl font-bold font-structural tracking-tight">
						Predict Subscriptions. <br />
						<span className="text-positive-text">Understand Why.</span>
					</h1>
					<p className="text-secondary font-body text-lg">
						Upload customer behavioral and financial records to instantly score
						term deposit subscription likelihood with transparent SHAP
						attribution.
					</p>

					<div
						{...getRootProps()}
						className={`mt-10 p-12 border border-dashed rounded-xl cursor-pointer transition-all duration-300 bg-surface/50 backdrop-blur-md
              ${isDragActive ? "border-electric shadow-glow bg-surface-elevated" : "border-white/10 hover:border-white/20"}
              ${uploadState === "error" ? "border-negative/50 bg-negative/5" : ""}
            `}
					>
						<input {...getInputProps()} />

						<div className="flex flex-col items-center gap-4">
							{uploadState === "idle" && (
								<>
									<div className="p-4 rounded-full bg-white/5 border border-white/10">
										<UploadCloud className="w-8 h-8 text-electric" />
									</div>
									<div>
										<p className="font-semibold">
											Drag & drop customer dataset (CSV)
										</p>
										<p className="text-sm text-secondary mt-1">
											Supports standard core banking schema.
										</p>
									</div>
								</>
							)}

							{uploadState === "loading" && (
								<div className="flex flex-col items-center gap-3 text-electric">
									<Loader2 className="w-8 h-8 animate-spin" />
									<p className="font-mono text-sm uppercase tracking-widest">
										Analyzing Data...
									</p>
								</div>
							)}

							{uploadState === "waking-server" && (
								<div className="flex flex-col items-center gap-3 text-electric">
									<Loader2 className="w-8 h-8 animate-spin" />
									<p className="font-mono text-sm uppercase tracking-widest">
										Waking up AI Engine...
									</p>
									<p className="text-xs text-secondary font-body">
										This may take up to 60 seconds on the first run (Cold
										Start).
									</p>
								</div>
							)}

							{uploadState === "error" && (
								<div className="flex flex-col items-center gap-3 text-negative">
									<AlertCircle className="w-8 h-8" />
									<p className="font-medium">Analysis Failed</p>
									<p className="text-xs text-secondary font-body">
										The server might be offline or the CSV format is incorrect.
										Try again.
									</p>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		);
	}

	// ==========================================
	// VIEW 2: THE INSIGHTS DASHBOARD
	// ==========================================
	const highProbCount =
		data?.results.filter((r) => r.subscription_probability > 0.7).length || 0;
	const avgScore =
		(data?.results.reduce(
			(acc, curr) => acc + curr.subscription_probability,
			0,
		) || 0) / (data?.total_processed || 1);

	return (
		<div className="min-h-screen bg-canvas text-primary font-body p-6 flex flex-col gap-6">
			{/* Top Navbar / KPIs */}
			<header className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<div className="bg-surface border border-white/10 rounded-lg p-5 flex items-center justify-between shadow-panel">
					<div>
						<p className="text-xs font-mono text-ghost uppercase tracking-wider mb-1">
							Total Processed
						</p>
						<p className="text-3xl font-structural font-bold">
							{data?.total_processed.toLocaleString()}
						</p>
					</div>
					<CheckCircle2 className="text-positive-text w-8 h-8 opacity-80" />
				</div>

				<div className="bg-surface border border-white/10 rounded-lg p-5 flex items-center justify-between shadow-panel relative overflow-hidden">
					<div className="absolute top-0 right-0 w-32 h-32 bg-positive opacity-5 blur-3xl rounded-full" />
					<div className="z-10">
						<p className="text-xs font-mono text-ghost uppercase tracking-wider mb-1">
							High Probability
						</p>
						<p className="text-3xl font-structural font-bold text-positive-text">
							{highProbCount}
						</p>
					</div>
				</div>

				<div className="bg-surface border border-white/10 rounded-lg p-5 flex items-center justify-between shadow-panel">
					<div>
						<p className="text-xs font-mono text-ghost uppercase tracking-wider mb-1">
							Avg Propensity
						</p>
						<p className="text-3xl font-structural font-bold">
							{(avgScore * 100).toFixed(1)}%
						</p>
					</div>
				</div>
			</header>

			{/* Main Split Content */}
			<main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
				{/* Left Pane: Lead Roster (60%) */}
				<div className="lg:col-span-7 bg-surface border border-white/10 rounded-lg shadow-panel flex flex-col overflow-hidden">
					<div className="p-4 border-b border-white/10 bg-surface-elevated">
						<h2 className="font-semibold text-sm tracking-wide">Lead Roster</h2>
					</div>
					<div className="flex-1 overflow-auto p-2">
						<table className="w-full text-sm text-left">
							<thead className="text-xs font-mono text-ghost uppercase sticky top-0 bg-surface">
								<tr>
									<th className="px-4 py-3 font-normal">Customer</th>
									<th className="px-4 py-3 font-normal">Job</th>
									<th className="px-4 py-3 font-normal text-right">
										Propensity
									</th>
								</tr>
							</thead>
							<tbody>
								{data?.results.map((row) => {
									const isSelected = selectedCustomer?.row_id === row.row_id;
									const probPct = (row.subscription_probability * 100).toFixed(
										0,
									);
									const isHigh = row.subscription_probability > 0.7;

									return (
										<tr
											key={row.row_id}
											onClick={() => setSelectedCustomer(row)}
											className={`cursor-pointer transition-colors border-b border-white/5 last:border-0
                        ${isSelected ? "bg-white/5" : "hover:bg-white/[0.02]"}
                      `}
										>
											<td className="px-4 py-3">
												<div className="flex items-center gap-2">
													<span
														className={`w-2 h-2 rounded-full ${isHigh ? "bg-positive-text" : "bg-negative-text"}`}
													/>
													<span className="font-medium text-white">
														Lead #{row.row_id}
													</span>
													<span className="text-xs text-secondary">
														Age {row.raw_data.age}
													</span>
												</div>
											</td>
											<td className="px-4 py-3 text-secondary capitalize">
												{row.raw_data.job || "Unknown"}
											</td>
											<td className="px-4 py-3 text-right">
												<span
													className={`px-2 py-1 rounded text-xs font-mono font-medium
                          ${isHigh ? "bg-positive-bg text-positive-text border border-positive/30" : "bg-negative-bg text-negative-text border border-negative/30"}
                        `}
												>
													{probPct}%
												</span>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>

				{/* Right Pane: Explainability Engine (40%) */}
				<div className="lg:col-span-5 bg-surface border border-white/10 rounded-lg shadow-panel flex flex-col relative overflow-hidden">
					<div className="absolute top-0 right-0 w-64 h-64 bg-electric opacity-[0.02] blur-3xl pointer-events-none" />

					<div className="p-4 border-b border-white/10 bg-surface-elevated flex justify-between items-center z-10">
						<h2 className="font-semibold text-sm flex items-center gap-2">
							<span className="text-electric font-mono text-lg leading-none">
								◱
							</span>
							Explainability Engine
						</h2>
						{selectedCustomer && (
							<span className="text-xs text-secondary font-mono">
								ID: {selectedCustomer.row_id}
							</span>
						)}
					</div>

					<div className="flex-1 p-6 flex flex-col z-10">
						{selectedCustomer ? (
							<>
								<div className="mb-6">
									<p className="text-sm text-secondary mb-1">
										Attribution for Lead #{selectedCustomer.row_id}
									</p>
									<div className="flex justify-between text-xs font-mono text-ghost mt-4">
										<span>Negative Friction (-)</span>
										<span>Positive Propensity (+)</span>
									</div>
								</div>

								<div className="flex-1 min-h-[300px]">
									<ResponsiveContainer width="100%" height="100%">
										<BarChart
											layout="vertical"
											data={getChartData()}
											margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
										>
											<Tooltip
												cursor={{ fill: "rgba(255,255,255,0.02)" }}
												contentStyle={{
													backgroundColor: "#1A1A22",
													borderColor: "rgba(255,255,255,0.1)",
													color: "#fff",
													fontSize: "12px",
													borderRadius: "8px",
												}}
											/>
											<XAxis
												type="number"
												hide
												domain={["dataMin", "dataMax"]}
											/>
											<YAxis
												dataKey="name"
												type="category"
												axisLine={false}
												tickLine={false}
												tick={{ fill: "#9E9EB2", fontSize: 12 }}
												width={100}
											/>
											<ReferenceLine
												x={0}
												stroke="rgba(255,255,255,0.1)"
												strokeDasharray="3 3"
											/>
											<Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
												{getChartData().map((entry, index) => (
													<Cell
														key={`cell-${index}`}
														fill={
															entry.type === "positive" ? "#10B981" : "#EF4444"
														}
														fillOpacity={0.8}
													/>
												))}
											</Bar>
										</BarChart>
									</ResponsiveContainer>
								</div>
							</>
						) : (
							<div className="flex h-full items-center justify-center text-ghost text-sm">
								Select a lead to view SHAP attribution
							</div>
						)}
					</div>
				</div>
			</main>

			{/* Floating Action / Sidebar (Gemini AI Chat) */}
			<div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
				{isChatOpen && (
					<div className="w-80 md:w-96 bg-surface-modal border border-white/15 rounded-xl shadow-panel mb-4 overflow-hidden flex flex-col h-[500px] transform transition-all duration-300 ease-out">
						<div className="p-3 bg-surface-elevated border-b border-white/10 flex justify-between items-center">
							<div className="flex items-center gap-2">
								<div className="w-5 h-5 rounded bg-gradient-to-br from-electric to-purple-600 flex items-center justify-center">
									<span className="text-white text-[10px] font-bold">AI</span>
								</div>
								<span className="font-semibold text-sm">Gemini Assistant</span>
								<span className="text-[9px] bg-electric/20 text-electric px-1.5 py-0.5 rounded uppercase font-mono tracking-wider ml-1">
									Live Context
								</span>
							</div>
							<button
								onClick={() => setIsChatOpen(false)}
								className="text-secondary hover:text-white transition-colors"
							>
								<X className="w-4 h-4" />
							</button>
						</div>

						<div className="flex-1 overflow-y-auto p-4 space-y-4">
							{chatMessages.length === 0 && (
								<div className="text-center text-xs text-ghost mt-4">
									Ask a question about this dataset or lead... <br />
									e.g., "Summarize the top reasons these leads were rejected."
								</div>
							)}
							{chatMessages.map((msg, i) => (
								<div
									key={i}
									className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
								>
									<div
										className={`text-sm p-3 rounded-lg max-w-[85%] ${
											msg.role === "user"
												? "bg-electric text-white rounded-br-none"
												: "bg-surface-elevated border border-white/10 text-primary rounded-bl-none font-body leading-relaxed"
										}`}
									>
										{msg.text}
									</div>
								</div>
							))}
							{isChatLoading && (
								<div className="flex justify-start">
									<div className="text-sm p-3 rounded-lg bg-surface-elevated border border-white/10 text-secondary rounded-bl-none flex gap-1">
										<span className="animate-bounce">.</span>
										<span className="animate-bounce delay-100">.</span>
										<span className="animate-bounce delay-200">.</span>
									</div>
								</div>
							)}
						</div>

						<div className="p-3 bg-surface-elevated border-t border-white/10 flex items-center gap-2">
							<input
								type="text"
								value={chatInput}
								onChange={(e) => setChatInput(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
								placeholder="Ask Gemini..."
								className="flex-1 bg-canvas border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-electric transition-colors"
							/>
							<button
								onClick={handleSendMessage}
								disabled={isChatLoading || !chatInput.trim()}
								className="bg-electric hover:bg-electric-hover text-white p-2 rounded-md transition-colors disabled:opacity-50"
							>
								<Send className="w-4 h-4" />
							</button>
						</div>
					</div>
				)}

				<button
					onClick={() => setIsChatOpen(!isChatOpen)}
					className={`p-4 rounded-full shadow-glow flex items-center justify-center transition-all duration-300
            ${isChatOpen ? "bg-surface-elevated border border-white/10 text-secondary" : "bg-electric text-white hover:bg-electric-hover"}
          `}
				>
					{isChatOpen ? (
						<X className="w-6 h-6" />
					) : (
						<MessageSquare className="w-6 h-6" />
					)}
				</button>
			</div>
		</div>
	);
}
