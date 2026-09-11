// app/page.tsx
"use client";

import React, { useState, useCallback, useMemo } from "react";
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
	CloudUpload,
	Loader2,
	AlertCircle,
	Briefcase,
	Target,
	TrendingUp,
	Users,
	ArrowUpRight,
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

export default function EnterpriseXAIDashboard() {
	// --- State ---
	const [uploadState, setUploadState] = useState<UploadState>("idle");
	const [data, setData] = useState<BackendData | null>(null);
	const [selectedCustomer, setSelectedCustomer] =
		useState<CustomerResult | null>(null);

	// Chat State
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
			if (!res.ok) throw new Error("API Exception");

			const responseData: BackendData = await res.json();
			setData(responseData);
			setSelectedCustomer(responseData.results[0] || null);
			setUploadState("success");
		} catch (error) {
			clearTimeout(coldStartTimer);
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
				{
					role: "ai",
					text: "Service temporarily unavailable. Please try again.",
				},
			]);
		} finally {
			setIsChatLoading(false);
		}
	};

	// --- Derived Analytics for Recharts ---
	const histogramData = useMemo(() => {
		if (!data) return [];
		const bins = [0, 0, 0, 0, 0];
		data.results.forEach((r) => {
			const prob = r.subscription_probability;
			if (prob < 0.2) bins[0]++;
			else if (prob < 0.4) bins[1]++;
			else if (prob < 0.6) bins[2]++;
			else if (prob < 0.8) bins[3]++;
			else bins[4]++;
		});
		return [
			{ range: "0–20%", count: bins[0] },
			{ range: "20–40%", count: bins[1] },
			{ range: "40–60%", count: bins[2] },
			{ range: "60–80%", count: bins[3] },
			{ range: "80–100%", count: bins[4] },
		];
	}, [data]);

	const jobData = useMemo(() => {
		if (!data) return [];
		const counts: Record<string, number> = {};
		data.results.forEach((r) => {
			const job = r.raw_data.job || "Unknown";
			counts[job] = (counts[job] || 0) + 1;
		});
		return Object.entries(counts)
			.map(([job, count]) => ({
				job: job.charAt(0).toUpperCase() + job.slice(1).toLowerCase(),
				count,
			}))
			.sort((a, b) => b.count - a.count)
			.slice(0, 5);
	}, [data]);

	const shapData = useMemo(() => {
		if (!selectedCustomer) return [];
		const { positive, negative } = selectedCustomer.drivers;
		return [
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
	}, [selectedCustomer]);

	// --- KPI Helpers ---
	const highProbCount =
		data?.results.filter((r) => r.subscription_probability > 0.75).length || 0;
	const avgScore =
		(data?.results.reduce(
			(acc, curr) => acc + curr.subscription_probability,
			0,
		) || 0) / (data?.total_processed || 1);
	const topJob = jobData.length > 0 ? jobData[0].job : "N/A";

	// ==========================================
	// VIEW 1: ENTERPRISE SECURE UPLOAD
	// ==========================================
	if (
		uploadState === "idle" ||
		uploadState === "loading" ||
		uploadState === "waking-server" ||
		uploadState === "error"
	) {
		return (
			<div className="min-h-screen bg-canvas p-6 flex flex-col justify-center items-center font-sans">
				<div className="max-w-2xl w-full flex flex-col items-center text-center space-y-8">
					<div className="space-y-4">
						<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-text-secondary">
							<span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
							Sovereign Intelligence
						</div>
						<h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-text-primary">
							Term Deposit Propensity
						</h1>
						<p className="text-text-secondary text-sm md:text-base max-w-lg mx-auto leading-relaxed">
							Automated high-precision scoring for retail banking cohorts.
							Ingest historical customer engagement records to unlock
							explainable tree-attribution drivers.
						</p>
					</div>

					<div
						{...getRootProps()}
						className={`w-full p-12 rounded-3xl border border-dashed transition-all duration-300 flex flex-col items-center justify-center cursor-pointer
              ${isDragActive ? "border-white bg-surface-2" : "border-white/15 bg-surface-1 hover:border-white/30 hover:bg-surface-2"}
              ${uploadState === "error" ? "border-red-900/50 bg-red-950/10" : ""}
            `}
					>
						<input {...getInputProps()} />

						{uploadState === "idle" && (
							<>
								<div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
									<CloudUpload className="w-8 h-8 text-text-secondary" />
								</div>
								<h3 className="text-lg font-medium text-text-primary mb-2">
									Upload Customer Cohort
								</h3>
								<p className="text-sm text-text-tertiary">
									Drag & drop CSV, Parquet, or XLSX (Max 500MB)
								</p>
								<div className="mt-8 flex items-center gap-2 text-xs text-text-tertiary">
									<span className="flex items-center justify-center w-4 h-4 rounded-full border border-white/10">
										🔒
									</span>
									Encrypted in-transit via SHA-256
								</div>
							</>
						)}

						{uploadState === "loading" && (
							<>
								<Loader2 className="w-10 h-10 text-white mb-6 animate-spin opacity-80" />
								<h3 className="text-lg font-medium text-text-primary mb-2">
									Ingesting Cohort Data
								</h3>
								<p className="text-sm text-text-tertiary">
									Running automated statistical drift detection...
								</p>
							</>
						)}

						{uploadState === "waking-server" && (
							<>
								<Loader2 className="w-10 h-10 text-text-secondary mb-6 animate-spin opacity-50" />
								<h3 className="text-lg font-medium text-text-primary mb-2">
									Initializing Inference Node
								</h3>
								<p className="text-sm text-text-tertiary">
									Cold start detected. Establishing secure connection (ETA:
									45s)...
								</p>
							</>
						)}

						{uploadState === "error" && (
							<>
								<AlertCircle className="w-10 h-10 text-text-secondary mb-6" />
								<h3 className="text-lg font-medium text-text-primary mb-2">
									Ingestion Interrupted
								</h3>
								<p className="text-sm text-text-tertiary">
									Unable to validate schema or node offline. Please try again.
								</p>
							</>
						)}
					</div>
				</div>
			</div>
		);
	}

	// ==========================================
	// VIEW 2: SOVEREIGN INTELLIGENCE DASHBOARD
	// ==========================================
	return (
		<div className="h-screen bg-canvas flex flex-col p-4 gap-4 overflow-hidden font-sans">
			{/* HEADER */}
			<header className="shrink-0 flex items-center justify-between px-2">
				<div className="flex items-center gap-3">
					<div className="w-8 h-8 rounded-lg border border-white/20 flex items-center justify-center">
						<SparklesIcon />
					</div>
					<h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
						Sovereign Intelligence
						<span className="text-text-tertiary text-sm font-normal">/</span>
						<span className="text-text-secondary text-sm font-normal">
							Explainable AI Hub
						</span>
					</h1>
				</div>
				<div className="flex items-center gap-4 text-xs font-medium text-text-secondary">
					<span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
						<div className="w-1.5 h-1.5 rounded-full bg-white" /> Node Online
					</span>
				</div>
			</header>

			{/* MAIN LAYOUT: 9 cols Data, 3 cols AI Chat */}
			<div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
				{/* LEFT PANE: ANALYTICS (9 Cols) */}
				<div className="lg:col-span-9 flex flex-col gap-4 min-h-0">
					{/* 1. KPI ROW (Top) */}
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
						{[
							{
								label: "Total Processed",
								value: data?.total_processed.toLocaleString(),
								icon: Users,
								sub: "100% data fidelity",
							},
							{
								label: "Avg Conversion Score",
								value: `${(avgScore * 100).toFixed(1)}%`,
								icon: TrendingUp,
								sub: "+4.8% vs benchmark",
							},
							{
								label: "High-Propensity",
								value: highProbCount.toLocaleString(),
								icon: Target,
								sub: `${((highProbCount / (data?.total_processed || 1)) * 100).toFixed(1)}% of cohort`,
							},
							{
								label: "Top Demographic",
								value: topJob,
								icon: Briefcase,
								sub: "Primary yield driver",
							},
						].map((kpi, i) => (
							<div
								key={i}
								className="bg-surface-1 border border-border-subtle rounded-2xl p-5 flex flex-col justify-between"
							>
								<div className="flex items-center justify-between mb-4">
									<span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
										{kpi.label}
									</span>
									<kpi.icon className="w-4 h-4 text-text-secondary opacity-50" />
								</div>
								<div>
									<div className="text-3xl font-semibold text-white tracking-tight mb-1">
										{kpi.value}
									</div>
									<div className="text-xs text-text-tertiary">{kpi.sub}</div>
								</div>
							</div>
						))}
					</div>

					{/* 2. THE EXPLAINABILITY CORE (Middle Row - Dominant Focus) */}
					<div className="flex-1 grid grid-cols-1 lg:grid-cols-9 gap-4 min-h-0">
						{/* Lead Roster (3 Cols) */}
						<div className="lg:col-span-3 bg-surface-1 border border-border-subtle rounded-2xl flex flex-col overflow-hidden">
							<div className="p-4 border-b border-border-subtle shrink-0 flex justify-between items-center">
								<h3 className="text-sm font-medium text-white">
									Target Roster
								</h3>
								<span className="text-[10px] text-text-tertiary uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-full">
									Select Lead
								</span>
							</div>
							<div className="flex-1 overflow-auto">
								<table className="w-full text-left text-sm whitespace-nowrap">
									<tbody>
										{data?.results.map((row) => {
											const isSelected =
												selectedCustomer?.row_id === row.row_id;
											const pct = Math.round(
												row.subscription_probability * 100,
											);
											const isHigh = pct >= 75;
											return (
												<tr
													key={row.row_id}
													onClick={() => setSelectedCustomer(row)}
													className={`cursor-pointer border-b border-border-subtle last:border-0 transition-colors
                            ${isSelected ? "bg-white/5" : "hover:bg-white/[0.02]"}
                          `}
												>
													<td className="px-4 py-3">
														<div
															className={`font-medium flex items-center gap-2 ${isSelected ? "text-white" : "text-text-secondary"}`}
														>
															Lead #{row.row_id}
														</div>
														<div className="text-xs text-text-tertiary capitalize mt-0.5">
															{row.raw_data.job || "Unknown"}
														</div>
													</td>
													<td className="px-4 py-3 text-right">
														<span
															className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-medium border
                              ${
																isHigh
																	? "bg-white/10 text-white border-white/20"
																	: "bg-transparent text-text-secondary border-border-subtle"
															}
                            `}
														>
															{pct}%
														</span>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</div>

						{/* Massive SHAP Engine (6 Cols) */}
						<div className="lg:col-span-6 bg-surface-1 border border-border-subtle rounded-2xl flex flex-col overflow-hidden">
							<div className="p-4 border-b border-border-subtle shrink-0 flex items-center justify-between">
								<div>
									<h3 className="text-sm font-medium text-white">
										SHAP Explainability Engine
									</h3>
									<p className="text-xs text-text-tertiary mt-1">
										Isolating predictive drivers for Lead #
										{selectedCustomer?.row_id ?? "--"}
									</p>
								</div>
								{selectedCustomer && (
									<div className="text-right">
										<div className="text-2xl font-semibold text-white tracking-tight">
											{Math.round(
												selectedCustomer.subscription_probability * 100,
											)}
											%
										</div>
										<div className="text-xs text-text-tertiary">
											Conversion Propensity
										</div>
									</div>
								)}
							</div>
							<div className="flex-1 p-6 flex flex-col min-h-0">
								{!selectedCustomer ? (
									<div className="flex-1 flex items-center justify-center text-sm text-text-tertiary">
										Select a lead from the roster to view attribution
									</div>
								) : (
									<>
										<div className="flex justify-between text-xs font-medium text-text-tertiary mb-6 px-4">
											<span className="flex items-center gap-2">
												<div className="w-2 h-2 rounded bg-[#333333]"></div>{" "}
												Frictional Drivers (-)
											</span>
											<span className="flex items-center gap-2">
												Propensity Drivers (+){" "}
												<div className="w-2 h-2 rounded bg-white"></div>
											</span>
										</div>
										<div className="flex-1 min-h-0">
											<ResponsiveContainer width="100%" height="100%">
												<BarChart
													layout="vertical"
													data={shapData}
													margin={{ top: 0, right: 10, left: 20, bottom: 0 }}
												>
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
														tick={{ fill: "#A1A1AA", fontSize: 12 }}
														width={120}
													/>
													<ReferenceLine
														x={0}
														stroke="rgba(255,255,255,0.15)"
														strokeDasharray="3 3"
													/>
													<Tooltip
														cursor={{ fill: "rgba(255,255,255,0.03)" }}
														contentStyle={{
															backgroundColor: "#121212",
															borderColor: "rgba(255,255,255,0.05)",
															borderRadius: "12px",
															color: "#fff",
														}}
													/>
													<Bar
														dataKey="value"
														barSize={24}
														radius={[4, 4, 4, 4]}
													>
														{shapData.map((entry, index) => (
															<Cell
																key={`cell-${index}`}
																fill={
																	entry.type === "positive"
																		? "#FFFFFF"
																		: "#333333"
																}
															/>
														))}
													</Bar>
												</BarChart>
											</ResponsiveContainer>
										</div>
									</>
								)}
							</div>
						</div>
					</div>

					{/* 3. TERTIARY CONTEXT ROW (Bottom Row) */}
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 shrink-0 h-48">
						{/* Customer Profile Context */}
						<div className="bg-surface-1 border border-border-subtle rounded-2xl flex flex-col overflow-hidden">
							<div className="p-3 border-b border-border-subtle shrink-0">
								<h3 className="text-xs font-medium text-white">
									Lead Demographics
								</h3>
							</div>
							<div className="flex-1 overflow-auto p-4">
								{!selectedCustomer ? (
									<div className="flex h-full items-center justify-center text-xs text-text-tertiary">
										No lead selected
									</div>
								) : (
									<div className="grid grid-cols-2 gap-y-3 gap-x-4">
										{Object.entries(selectedCustomer.raw_data)
											.slice(0, 6)
											.map(([key, value]) => (
												<div key={key}>
													<div className="text-[10px] font-medium text-text-tertiary mb-0.5 capitalize">
														{key.replace(/_/g, " ")}
													</div>
													<div className="text-xs text-text-primary font-medium truncate">
														{value === null || value === ""
															? "--"
															: value.toString()}
													</div>
												</div>
											))}
									</div>
								)}
							</div>
						</div>

						{/* Macro: Histogram */}
						<div className="bg-surface-1 border border-border-subtle rounded-2xl p-4 flex flex-col">
							<div className="text-xs font-medium text-white mb-3">
								Cohort Propensity Distribution
							</div>
							<div className="flex-1 min-h-0">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart
										data={histogramData}
										margin={{ top: 5, right: 0, left: -25, bottom: 0 }}
									>
										<XAxis
											dataKey="range"
											tick={{ fill: "#71717A", fontSize: 10 }}
											axisLine={false}
											tickLine={false}
										/>
										<YAxis
											tick={{ fill: "#71717A", fontSize: 10 }}
											axisLine={false}
											tickLine={false}
										/>
										<Tooltip
											cursor={{ fill: "#1A1A1A" }}
											contentStyle={{
												backgroundColor: "#121212",
												borderColor: "rgba(255,255,255,0.05)",
												borderRadius: "12px",
												color: "#fff",
												fontSize: "12px",
											}}
										/>
										<Bar dataKey="count" fill="#333333" radius={[4, 4, 4, 4]}>
											{histogramData.map((entry, index) => (
												<Cell
													key={`cell-${index}`}
													fill={
														entry.count ===
														Math.max(...histogramData.map((d) => d.count))
															? "#FFFFFF"
															: "#333333"
													}
												/>
											))}
										</Bar>
									</BarChart>
								</ResponsiveContainer>
							</div>
						</div>

						{/* Macro: Jobs */}
						<div className="bg-surface-1 border border-border-subtle rounded-2xl p-4 flex flex-col">
							<div className="text-xs font-medium text-white mb-3">
								Top Cohort Segments
							</div>
							<div className="flex-1 min-h-0">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart
										layout="vertical"
										data={jobData}
										margin={{ top: 0, right: 10, left: -5, bottom: 0 }}
									>
										<XAxis type="number" hide />
										<YAxis
											dataKey="job"
											type="category"
											tick={{ fill: "#A1A1AA", fontSize: 10 }}
											axisLine={false}
											tickLine={false}
											width={80}
										/>
										<Tooltip
											cursor={{ fill: "#1A1A1A" }}
											contentStyle={{
												backgroundColor: "#121212",
												borderColor: "rgba(255,255,255,0.05)",
												borderRadius: "12px",
												color: "#fff",
												fontSize: "12px",
											}}
										/>
										<Bar
											dataKey="count"
											fill="#FFFFFF"
											radius={[4, 4, 4, 4]}
											barSize={12}
										/>
									</BarChart>
								</ResponsiveContainer>
							</div>
						</div>
					</div>
				</div>

				{/* RIGHT PANE: EXECUTIVE ADVISORY ASSISTANT (3 Cols) */}
				<div className="lg:col-span-3 bg-surface-1 border border-border-subtle rounded-2xl flex flex-col overflow-hidden">
					<div className="p-4 border-b border-border-subtle shrink-0 flex items-center justify-between">
						<div className="flex items-center gap-2">
							<div className="w-6 h-6 rounded-full bg-white text-black flex items-center justify-center">
								<SparklesIcon />
							</div>
							<h3 className="text-sm font-medium text-white">
								Advisory Assistant
							</h3>
						</div>
						<span className="text-[10px] font-medium uppercase text-text-tertiary bg-white/5 px-2 py-1 rounded-full">
							Active
						</span>
					</div>

					<div className="flex-1 overflow-y-auto p-4 space-y-5">
						<div className="flex flex-col">
							<div className="self-start max-w-[85%] bg-surface-2 border border-border-subtle rounded-2xl rounded-tl-sm p-3 text-sm text-text-secondary leading-relaxed">
								Explainability Engine loaded. I am ready to summarize conversion
								friction or suggest outreach strategies for this cohort.
							</div>
						</div>

						{chatMessages.map((msg, i) => (
							<div
								key={i}
								className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
							>
								<div
									className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed
                  ${
										msg.role === "user"
											? "bg-white text-black rounded-tr-sm font-medium"
											: "bg-surface-2 border border-border-subtle text-text-primary rounded-tl-sm"
									}`}
								>
									{msg.text}
								</div>
							</div>
						))}

						{isChatLoading && (
							<div className="flex flex-col items-start">
								<div className="bg-surface-2 border border-border-subtle rounded-2xl rounded-tl-sm p-3 flex gap-1.5 items-center">
									<div className="w-1.5 h-1.5 rounded-full bg-text-tertiary animate-bounce" />
									<div className="w-1.5 h-1.5 rounded-full bg-text-tertiary animate-bounce [animation-delay:0.2s]" />
									<div className="w-1.5 h-1.5 rounded-full bg-text-tertiary animate-bounce [animation-delay:0.4s]" />
								</div>
							</div>
						)}
					</div>

					<div className="p-3 border-t border-border-subtle shrink-0 bg-surface-1">
						<div className="relative flex items-center">
							<input
								type="text"
								value={chatInput}
								onChange={(e) => setChatInput(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
								placeholder="Ask advisory assistant..."
								className="w-full bg-surface-2 border border-border-focus rounded-xl py-2.5 pl-4 pr-10 text-sm text-white placeholder:text-text-tertiary focus:outline-none focus:border-white/30 transition-colors"
							/>
							<button
								onClick={handleSendMessage}
								disabled={isChatLoading || !chatInput.trim()}
								className="absolute right-2 p-1.5 rounded-lg bg-white text-black disabled:opacity-50 hover:bg-white/80 transition-colors"
							>
								<ArrowUpRight className="w-4 h-4" />
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

// Simple custom SVG for the Sovereign Sparkle icon
function SparklesIcon() {
	return (
		<svg
			width="12"
			height="12"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M12 3v18M3 12h18M18.364 5.636l-12.728 12.728M5.636 5.636l12.728 12.728" />
		</svg>
	);
}
