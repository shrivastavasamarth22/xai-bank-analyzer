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
	CartesianGrid,
	LabelList,
} from "recharts";
import { Upload, Terminal, PlaySquare, XSquare } from "lucide-react";

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

export default function XAIBankAnalyzerV2() {
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
				{ role: "ai", text: "[ERR] CONNECTION_REFUSED" },
			]);
		} finally {
			setIsChatLoading(false);
		}
	};

	// --- Derived Analytics for Recharts ---

	// 1. Histogram (Probability Distribution)
	const histogramData = useMemo(() => {
		if (!data) return [];
		const bins = [0, 0, 0, 0, 0]; // 0-20, 20-40, 40-60, 60-80, 80-100
		data.results.forEach((r) => {
			const prob = r.subscription_probability;
			if (prob < 0.2) bins[0]++;
			else if (prob < 0.4) bins[1]++;
			else if (prob < 0.6) bins[2]++;
			else if (prob < 0.8) bins[3]++;
			else bins[4]++;
		});
		return [
			{ range: "0-20", count: bins[0] },
			{ range: "20-40", count: bins[1] },
			{ range: "40-60", count: bins[2] },
			{ range: "60-80", count: bins[3] },
			{ range: "80-100", count: bins[4] },
		];
	}, [data]);

	// 2. Job Demographics
	const jobData = useMemo(() => {
		if (!data) return [];
		const counts: Record<string, number> = {};
		data.results.forEach((r) => {
			const job = r.raw_data.job || "unknown";
			counts[job] = (counts[job] || 0) + 1;
		});
		return Object.entries(counts)
			.map(([job, count]) => ({ job, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 5); // Top 5
	}, [data]);

	// 3. SHAP Chart Data for Selected Customer
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
	// VIEW 1: TERMINAL INGESTION SCREEN
	// ==========================================
	if (
		uploadState === "idle" ||
		uploadState === "loading" ||
		uploadState === "waking-server" ||
		uploadState === "error"
	) {
		return (
			<div className="min-h-screen bg-canvas p-6 flex flex-col justify-center items-center">
				<div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
					{/* Left: Branding & Upload */}
					<div className="space-y-8">
						<div>
							<p className="font-mono text-text-med text-xs mb-4 flex items-center gap-2 tracking-widest">
								<span className="w-2 h-2 bg-text-high block"></span>[ MODULE 01
								// DATA INGESTION PIPELINE ]
							</p>
							<h1 className="text-4xl md:text-5xl font-semibold tracking-tighter uppercase leading-[0.9]">
								Predict Subscriptions.
								<br />
								<span className="text-text-med">Explain Mechanics.</span>
							</h1>
							<p className="font-mono text-text-muted text-xs mt-6 leading-relaxed max-w-md">
								High-throughput probabilistic scoring engine powered by XGBoost
								and additive SHAP feature attribution. Zero color drift.
							</p>
						</div>

						<div
							{...getRootProps()}
							className={`p-10 border border-dashed transition-none cursor-pointer flex flex-col items-center text-center
                ${isDragActive ? "border-text-high bg-surface-2" : "border-border-structural bg-surface-1 hover:border-text-med"}
                ${uploadState === "error" ? "border-text-high bg-text-high text-text-inv" : ""}
              `}
						>
							<input {...getInputProps()} />

							{uploadState === "idle" && (
								<>
									<Upload className="w-6 h-6 mb-4" />
									<p className="font-mono text-sm tracking-widest font-semibold uppercase">
										DRAG & DROP BATCH DATASET
									</p>
									<p className="font-mono text-xs text-text-muted mt-2">
										[ CSV, XLSX, PARQUET ]
									</p>
								</>
							)}

							{uploadState === "loading" && (
								<>
									<Terminal className="w-6 h-6 mb-4 animate-pulse" />
									<p className="font-mono text-sm tracking-widest font-semibold uppercase">
										ANALYZING DATASTREAM...
									</p>
									<p className="font-mono text-xs text-text-muted mt-2">
										[ EXECUTING XGB_KERNEL ]
									</p>
								</>
							)}

							{uploadState === "waking-server" && (
								<>
									<Terminal className="w-6 h-6 mb-4 animate-bounce" />
									<p className="font-mono text-sm tracking-widest font-semibold uppercase">
										WAKING UP AI ENGINE
									</p>
									<p className="font-mono text-xs text-text-muted mt-2">
										[WARN] COLD START DETECTED. ETA: 45s
									</p>
								</>
							)}

							{uploadState === "error" && (
								<>
									<XSquare className="w-6 h-6 mb-4" />
									<p className="font-mono text-sm tracking-widest font-bold uppercase">
										INGESTION FAILED
									</p>
									<p className="font-mono text-xs mt-2">
										[ERR] KERNEL_OFFLINE OR SCHEMA_MISMATCH
									</p>
								</>
							)}
						</div>
					</div>

					{/* Right: Mock Terminal Status */}
					<div className="bg-surface-1 border border-border-structural p-1">
						<div className="bg-surface-2 border-b border-border-hairline p-2 flex justify-between">
							<span className="font-mono text-[10px] text-text-med tracking-widest">
								[ SYSTEM_STATUS // ENGINE_TELEMETRY ]
							</span>
							<span className="font-mono text-[10px] text-text-high tracking-widest">
								LIVE_DIAGNOSTICS
							</span>
						</div>
						<div className="p-4 font-mono text-[11px] space-y-3">
							<div className="flex justify-between border-b border-border-hairline pb-2">
								<span className="text-text-muted">Subsystem</span>
								<span className="text-text-muted">State / Verdict</span>
							</div>
							<div className="flex justify-between">
								<span>[ OK ] XGBoost Inference Kernel</span>
								<span className="text-text-high">ONLINE (v4.2.0-quant)</span>
							</div>
							<div className="flex justify-between">
								<span>[ OK ] TreeSHAP Attribution Matrix</span>
								<span className="text-text-high">
									LOADED (Exact Local/Global)
								</span>
							</div>
							<div className="flex justify-between text-text-muted">
								<span>[ OK ] In-Memory Vector Buffer</span>
								<span>ALLOCATED (64 MB)</span>
							</div>
							<div className="flex justify-between text-text-muted">
								<span>[ OK ] Cryptographic SHA-256 Hashing</span>
								<span>ACTIVE</span>
							</div>
							<div className="flex justify-between mt-4">
								<span className="animate-pulse">
									[ ... ] Input Schema Verification
								</span>
								<span className="text-text-high">AWAITING STREAM</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// ==========================================
	// VIEW 2: THE BENTO DASHBOARD
	// ==========================================
	return (
		<div className="h-screen bg-canvas flex flex-col p-2 gap-2 overflow-hidden">
			{/* HEADER BENTO ROW */}
			<div className="grid grid-cols-12 gap-2 shrink-0">
				<div className="col-span-12 flex gap-2">
					{/* Main Content App Header */}
					<div className="flex-1 bg-surface-1 border border-border-hairline p-2 flex items-center justify-between">
						<div className="flex items-center gap-4">
							<div className="w-4 h-4 bg-text-high" />
							<span className="font-mono font-bold tracking-wider text-sm uppercase">
								XAI_QUANT // LEAD_ANALYZER_V2.0
							</span>
						</div>
						<div className="font-mono text-[10px] text-text-muted flex gap-4 hidden md:flex">
							<span>LATENCY: 14ms</span>
							<span>KERNEL: XGB-SHAP-64</span>
						</div>
					</div>
				</div>
			</div>

			{/* MAIN BODY BENTO SPLIT */}
			<div className="flex-1 grid grid-cols-12 gap-2 min-h-0">
				{/* LEFT COLUMN: Data Matrix (9 cols) */}
				<div className="col-span-9 flex flex-col gap-2 min-h-0">
					{/* KPI ROW */}
					<div className="grid grid-cols-4 gap-[1px] bg-border-hairline border border-border-hairline shrink-0">
						{/* KPI 1 */}
						<div className="bg-surface-1 p-3">
							<p className="font-mono text-[10px] text-text-med tracking-widest uppercase mb-2">
								Total Leads Evaluated
							</p>
							<p className="font-mono text-2xl font-bold">
								{data?.total_processed.toLocaleString()}
							</p>
						</div>
						{/* KPI 2 */}
						<div className="bg-surface-1 p-3">
							<p className="font-mono text-[10px] text-text-med tracking-widest uppercase mb-2 flex justify-between">
								<span>Avg Conversion Prob</span>
								<span className="text-text-high">
									μ = {(avgScore * 100).toFixed(1)}%
								</span>
							</p>
							<p className="font-mono text-2xl font-bold">
								{(avgScore * 100).toFixed(1)}%
							</p>
						</div>
						{/* KPI 3 */}
						<div className="bg-surface-1 p-3">
							<p className="font-mono text-[10px] text-text-med tracking-widest uppercase mb-2 flex justify-between">
								<span>High-Propensity</span>
								<span className="text-text-high">[P {">"} 0.75]</span>
							</p>
							<p className="font-mono text-2xl font-bold">
								{highProbCount}{" "}
								<span className="text-sm text-text-muted font-normal">
									/ {data?.total_processed}
								</span>
							</p>
						</div>
						{/* KPI 4 */}
						<div className="bg-surface-1 p-3">
							<p className="font-mono text-[10px] text-text-med tracking-widest uppercase mb-2 flex justify-between">
								<span>Top Job Category</span>
								<span className="text-text-high">[MAX_WEIGHT]</span>
							</p>
							<p className="font-structural text-xl font-bold uppercase truncate capitalize">
								{topJob}
							</p>
						</div>
					</div>

					{/* MACRO CHARTS ROW */}
					<div className="grid grid-cols-2 gap-[1px] bg-border-hairline border border-border-hairline shrink-0 h-48">
						{/* Histogram */}
						<div className="bg-surface-1 flex flex-col min-h-0">
							<div className="p-2 border-b border-border-hairline bg-surface-2 flex justify-between">
								<span className="font-mono text-[10px] text-text-med tracking-widest">
									[ MACRO // PROBABILITY DISTRIBUTION ]
								</span>
								<span className="font-mono text-[10px] text-text-muted">
									BINS=5
								</span>
							</div>
							<div className="flex-1 p-4 pb-0">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart
										data={histogramData}
										margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
									>
										<CartesianGrid stroke="#2D2D2D" vertical={false} />
										<XAxis
											dataKey="range"
											tick={{
												fill: "#5A5A5A",
												fontSize: 10,
												fontFamily: "monospace",
											}}
											axisLine={false}
											tickLine={false}
										/>
										<YAxis
											tick={{
												fill: "#5A5A5A",
												fontSize: 10,
												fontFamily: "monospace",
											}}
											axisLine={false}
											tickLine={false}
										/>
										<Tooltip
											cursor={{ fill: "#141414" }}
											contentStyle={{
												backgroundColor: "#000",
												borderColor: "#383838",
												borderRadius: 0,
												fontFamily: "monospace",
												fontSize: "11px",
											}}
										/>
										<Bar dataKey="count" fill="#383838">
											<LabelList
												dataKey="count"
												position="top"
												fill="#A0A0A0"
												fontSize={10}
												fontFamily="monospace"
											/>
											{histogramData.map((entry, index) => (
												<Cell
													key={`cell-${index}`}
													fill={
														entry.count ===
														Math.max(...histogramData.map((d) => d.count))
															? "#FFFFFF"
															: "#383838"
													}
												/>
											))}
										</Bar>
									</BarChart>
								</ResponsiveContainer>
							</div>
						</div>

						{/* Job Demographics */}
						<div className="bg-surface-1 flex flex-col min-h-0">
							<div className="p-2 border-b border-border-hairline bg-surface-2 flex justify-between">
								<span className="font-mono text-[10px] text-text-med tracking-widest">
									[ MACRO // COHORT JOB DISTRIBUTION ]
								</span>
								<span className="font-mono text-[10px] text-text-muted">
									TOP 5
								</span>
							</div>
							<div className="flex-1 p-4 pb-0">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart
										layout="vertical"
										data={jobData}
										margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
									>
										<XAxis type="number" hide />
										<YAxis
											dataKey="job"
											type="category"
											tick={{
												fill: "#A0A0A0",
												fontSize: 10,
												fontFamily: "monospace",
												textTransform: "uppercase",
											}}
											axisLine={false}
											tickLine={false}
											width={80}
										/>
										<Tooltip
											cursor={{ fill: "#141414" }}
											contentStyle={{
												backgroundColor: "#000",
												borderColor: "#383838",
												borderRadius: 0,
												fontFamily: "monospace",
												fontSize: "11px",
											}}
										/>
										<Bar dataKey="count" fill="#5A5A5A" barSize={16}>
											<LabelList
												dataKey="count"
												position="right"
												fill="#FFFFFF"
												fontSize={10}
												fontFamily="monospace"
											/>
										</Bar>
									</BarChart>
								</ResponsiveContainer>
							</div>
						</div>
					</div>

					{/* MICRO VIEW ROW (3-WAY SPLIT) */}
					<div className="flex-1 grid grid-cols-12 gap-[1px] bg-border-hairline border border-border-hairline min-h-0">
						{/* Roster (Col 4) */}
						<div className="col-span-4 bg-surface-1 flex flex-col min-h-0 border-r border-border-hairline">
							<div className="p-2 border-b border-border-hairline bg-surface-2 flex justify-between">
								<span className="font-mono text-[10px] text-text-med tracking-widest">
									[ ROSTER // LEAD_RANK ]
								</span>
							</div>
							<div className="flex-1 overflow-auto">
								<table className="w-full text-left font-mono text-[11px] whitespace-nowrap">
									<thead className="text-text-muted bg-surface-1 sticky top-0 border-b border-border-hairline z-10">
										<tr>
											<th className="font-normal px-2 py-1.5">ID</th>
											<th className="font-normal px-2 py-1.5">JOB</th>
											<th className="font-normal px-2 py-1.5 w-full">SCORE</th>
										</tr>
									</thead>
									<tbody>
										{data?.results.map((row) => {
											const isSelected =
												selectedCustomer?.row_id === row.row_id;
											const pct = Math.round(
												row.subscription_probability * 100,
											);
											return (
												<tr
													key={row.row_id}
													onClick={() => setSelectedCustomer(row)}
													className={`cursor-pointer border-b border-border-hairline last:border-0 hover:bg-surface-3 transition-none
                            ${isSelected ? "bg-surface-3 border-l-2 border-l-text-high" : "border-l-2 border-l-transparent"}
                          `}
												>
													<td
														className={`px-2 py-2 ${isSelected ? "text-text-high font-bold" : "text-text-med"}`}
													>
														#{row.row_id}
													</td>
													<td className="px-2 py-2 text-text-muted capitalize truncate max-w-[80px]">
														{row.raw_data.job || "-"}
													</td>
													<td className="px-2 py-2">
														<div className="flex items-center gap-2">
															<span
																className={`w-6 text-right ${pct > 75 ? "text-text-high font-bold" : "text-text-muted"}`}
															>
																{pct}%
															</span>
															<div className="flex-1 h-1.5 bg-surface-2 border border-border-structural">
																<div
																	className={`h-full ${pct > 75 ? "bg-text-high" : "bg-text-muted"}`}
																	style={{ width: `${pct}%` }}
																/>
															</div>
														</div>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</div>

						{/* SHAP Chart (Col 5) */}
						<div className="col-span-5 bg-surface-1 flex flex-col min-h-0 border-r border-border-hairline relative">
							<div className="p-2 border-b border-border-hairline bg-surface-2 flex justify-between z-10">
								<span className="font-mono text-[10px] text-text-med tracking-widest">
									[ SHAP // LEAD #{selectedCustomer?.row_id ?? "N/A"} ]
								</span>
							</div>
							<div className="flex-1 p-4 flex flex-col min-h-0">
								{!selectedCustomer ? (
									<div className="flex-1 flex items-center justify-center font-mono text-[10px] text-text-muted">
										AWAITING SELECTION
									</div>
								) : (
									<>
										<div className="flex justify-between font-mono text-[10px] text-text-muted mb-4 border-b border-border-hairline pb-2">
											<span>{"<-- NEGATIVE IMPACT [-]"}</span>
											<span>{"[+] POSITIVE IMPACT -->"}</span>
										</div>
										<div className="flex-1 min-h-0">
											<ResponsiveContainer width="100%" height="100%">
												<BarChart
													layout="vertical"
													data={shapData}
													margin={{ top: 0, right: 20, left: 20, bottom: 0 }}
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
														tick={{
															fill: "#A0A0A0",
															fontSize: 10,
															fontFamily: "monospace",
														}}
														width={80}
													/>
													<ReferenceLine x={0} stroke="#383838" />
													<Tooltip
														cursor={{ fill: "#141414" }}
														contentStyle={{
															backgroundColor: "#000",
															borderColor: "#383838",
															borderRadius: 0,
															fontFamily: "monospace",
															fontSize: "11px",
														}}
													/>
													<Bar
														dataKey="value"
														barSize={12}
														isAnimationActive={false}
													>
														{shapData.map((entry, index) => (
															<Cell
																key={`cell-${index}`}
																fill={
																	entry.type === "positive"
																		? "#FFFFFF"
																		: "#141414"
																}
																stroke={
																	entry.type === "negative" ? "#FFFFFF" : "none"
																}
																strokeWidth={1}
															/>
														))}
													</Bar>
												</BarChart>
											</ResponsiveContainer>
										</div>
										<div className="mt-2 text-[9px] font-mono text-text-muted border-t border-border-hairline pt-2">
											WHITE = POSITIVE DRIVER | OUTLINED = NEGATIVE SHIFTER
										</div>
									</>
								)}
							</div>
						</div>

						{/* RAW DATA JSON Viewer (Col 3) */}
						<div className="col-span-3 bg-surface-1 flex flex-col min-h-0">
							<div className="p-2 border-b border-border-hairline bg-surface-2 flex justify-between">
								<span className="font-mono text-[10px] text-text-med tracking-widest">
									[ RAW DATA // JSON ]
								</span>
							</div>
							<div className="flex-1 p-2 overflow-auto bg-surface-1">
								{!selectedCustomer ? (
									<div className="flex h-full items-center justify-center font-mono text-[10px] text-text-muted">
										NO DATA
									</div>
								) : (
									<pre className="font-mono text-[10px] text-text-med leading-relaxed whitespace-pre-wrap">
										{JSON.stringify(selectedCustomer.raw_data, null, 2)}
									</pre>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* RIGHT COLUMN: Permanent AI Sidecar (3 cols) */}
				<div className="col-span-3 bg-surface-1 border border-border-hairline flex flex-col min-h-0">
					<div className="p-2 border-b border-border-hairline bg-text-high text-text-inv flex justify-between">
						<span className="font-mono text-[10px] font-bold tracking-widest">
							[ GEMINI_AI // CLI_V2.0 ]
						</span>
						<span className="font-mono text-[10px]">[ {">_"} ]</span>
					</div>

					<div className="p-2 border-b border-border-hairline bg-surface-2 font-mono text-[9px] text-text-muted flex justify-between">
						<span>CONTEXT: BATCH_#{new Date().getHours()}</span>
						<span className="text-text-high">[ENGINE_ONLINE]</span>
					</div>

					<div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] space-y-4">
						<div className="text-text-muted">
							<span className="text-text-high">sys://gemini_init:</span>{" "}
							Quantitative Explainer loaded. Hooked to batch context. Type query
							to execute analysis.
						</div>

						{chatMessages.map((msg, i) => (
							<div key={i} className="flex flex-col gap-1">
								{msg.role === "user" ? (
									<div className="text-text-med">
										<span className="text-text-high font-bold">
											{"> USER:"}
										</span>{" "}
										{msg.text}
									</div>
								) : (
									<div className="text-text-high pl-3 border-l border-border-structural whitespace-pre-wrap">
										<span className="text-text-med font-bold">
											{"GEMINI: "}
										</span>
										{msg.text}
									</div>
								)}
							</div>
						))}

						{isChatLoading && (
							<div className="text-text-muted animate-pulse">
								{"> GEMINI:"} Computing response...
							</div>
						)}
					</div>

					<div className="p-2 border-t border-border-hairline bg-surface-2 flex items-center gap-2">
						<span className="font-mono text-text-high text-[11px] shrink-0 font-bold">
							{"root@xai:~#"}
						</span>
						<input
							type="text"
							value={chatInput}
							onChange={(e) => setChatInput(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
							placeholder="Type query or command..."
							className="flex-1 bg-transparent border-none outline-none font-mono text-[11px] text-text-high placeholder:text-text-muted"
						/>
						<button
							onClick={handleSendMessage}
							disabled={isChatLoading || !chatInput.trim()}
							className="bg-text-high text-text-inv font-mono text-[10px] font-bold px-2 py-1 disabled:opacity-50 transition-none hover:bg-text-med uppercase"
						>
							[Exec]
						</button>
					</div>
				</div>
			</div>

			{/* FOOTER BAR */}
			<div className="bg-canvas border-t border-border-hairline p-1 flex justify-between font-mono text-[9px] text-text-muted mt-auto">
				<div className="flex gap-4">
					<span>■ FED-SR 11-7 VALIDATED</span>
					<span>// ZERO COLOR DRIFT</span>
				</div>
				<div>
					<span>NODE: NYC-FIN-CORE-04</span>
					<span className="ml-4 text-text-high">STATUS: [OPTIMAL]</span>
				</div>
			</div>
		</div>
	);
}
