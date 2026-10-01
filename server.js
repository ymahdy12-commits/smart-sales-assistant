import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
const OPENAI_BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";

app.use(express.json({ limit: "2mb" }));
app.use(express.static(__dirname));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "smart-sales-assistant", transcriptionProvider: process.env.STT_PROVIDER || "mock", summaryProvider: process.env.SUMMARY_PROVIDER || "mock" });
});

function splitSentences(text) {
  return String(text || "").split(/(?<=[.!؟?])\s+/).map(s => s.trim()).filter(Boolean);
}

function extractSignals(text) {
  const sentences = splitSentences(text);
  const buckets = {
    needs: ["need","needs","احتياج","محتاج","عايز","نحتاج","هدف"],
    painPoints: ["problem","pain","مشكلة","معاناة","ضعف","مش شغال"],
    objections: ["objection","غالي","سعر","ميزانية","budget","price","cost","مش مقتنع","متردد"],
    timeline: ["timeline","متى","متى نبدأ","ابدأ","نبدأ","next month","هذا الأسبوع","الأسبوع الجاي"],
    competitors: ["competitor","منافس","شركة ثانية","شركة تانية","agency","وكالة"],
    decision: ["decision maker","صاحب القرار","المالك","الإدارة","المدير","موافقة"]
  };
  const result = {};
  for (const [key, terms] of Object.entries(buckets)) {
    result[key] = sentences.filter(s => terms.some(t => s.toLowerCase().includes(t.toLowerCase()))).slice(0, 10);
  }
  return result;
}

function ensureArray(v){return Array.isArray(v)&&v.length?v:["Not mentioned"];}
function evidenceItem(text,evidence){return {text:text||"Not mentioned",evidence:evidence||"Not mentioned"};}
function buildEnhancedMockSummary(body){
 const base=buildMockSummary(body), transcript=String(body.transcript||""), segments=Array.isArray(body.segments)?body.segments:[];
 const customerSegments=segments.filter(s=>/customer|client|speaker 1|speaker 2/i.test(String(s.speaker||"")));
 const chronological=segments.length?segments.map(s=>({speaker:s.speaker||"Speaker",start_ms:s.start_ms??"Not mentioned",text:s.text||"Not mentioned"})):splitSentences(transcript).map((text,i)=>({speaker:"Not mentioned",start_ms:"Not mentioned",text}));
 return {...base,
  customer_context:{current_situation:"Not mentioned",business_model:"Not mentioned",marketing_sales_setup:"Not mentioned",existing_tools:"Not mentioned",current_provider:"Not mentioned",previous_attempts:"Not mentioned",desired_outcome:"Not mentioned"},
  needs:ensureArray(base.needs).map(x=>evidenceItem(x, x==="Not mentioned"?"Not mentioned":x)),
  pain_points:ensureArray(base.pain_points).map(x=>evidenceItem(x, x==="Not mentioned"?"Not mentioned":x)),
  objections:ensureArray(base.objections).map(x=>({objection:x,response:"Not mentioned",evidence:x})),
  pricing_and_budget:{budget:"Not mentioned",pricing_discussed:"Not mentioned",price_sensitivity:"Not mentioned",scope:"Not mentioned",payment_constraints:"Not mentioned"},
  competitors:ensureArray(base.competitors),
  decision_maker:"Not mentioned",authority:"Not mentioned",urgency:"Not mentioned",timeline:"Not mentioned",buying_stage:"Not mentioned",
  buying_signals:[].concat(base.buying_signals||[]),risk_signals:[].concat(base.risk_signals||[]),
  agreements:["Not mentioned"],disagreements:["Not mentioned"],open_questions:["Not mentioned"],
  chronological_summary:chronological,
  customer_statements:customerSegments.length?customerSegments.map(s=>s.text):["Not mentioned"],
  customer_questions:["Not mentioned"],salesperson_questions:["Not mentioned"],responses_given:["Not mentioned"],
  next_steps:[{owner:"Not mentioned",action:"Not mentioned",deadline:"Not mentioned"}],
  crm_summary:base.crm_summary,
  follow_up_message:base.follow_up_message
 };
}

function buildMockSummary(body) {
  const meeting = body.meeting || {};
  const transcript = String(body.transcript || "");
  const signals = extractSignals(transcript);
  return {
    executive_summary: transcript ? "Meeting between " + (meeting.company || "the customer") + " and the sales team. Structured extraction is active; connect a production AI provider for deeper interpretation." : "No transcript was supplied.",
    meeting_details: { title: meeting.title || "Not mentioned", company: meeting.company || "Not mentioned", industry: meeting.industry || "Not mentioned", date_time: meeting.date_time || "Not mentioned" },
    participants: meeting.attendees || "Not mentioned",
    customer_context: { current_situation:"Not mentioned", business_model:"Not mentioned", existing_setup:"Not mentioned" },
    needs: signals.needs.length ? signals.needs : ["Not mentioned"],
    pain_points: signals.painPoints.length ? signals.painPoints : ["Not mentioned"],
    requirements: ["Not mentioned"],
    objections: signals.objections.length ? signals.objections : ["Not mentioned"],
    pricing_and_budget: ["Not mentioned"],
    competitors: signals.competitors.length ? signals.competitors : ["Not mentioned"],
    buying_signals: [],
    risk_signals: [],
    decisions: signals.decision.length ? signals.decision : ["Not mentioned"],
    open_questions: ["Not mentioned"],
    next_steps: [{ owner:"Sales", action:"Review transcript and confirm missing commercial details.", deadline:"Not mentioned" }],
    crm_summary: transcript ? (meeting.company || "Customer") + " — meeting completed. Review needs, objections, decision process and timeline before the next follow-up." : "Not mentioned",
    follow_up_message: "Not generated until an AI summary provider is configured."
  };
}

async function openAITranscribe(file, body){
 if(!OPENAI_KEY) throw new Error("OPENAI_API_KEY is not configured.");
 const form=new FormData();
 form.append("file",new Blob([file.buffer],{type:file.mimetype||"audio/webm"}),file.originalname||"meeting.webm");
 form.append("model",process.env.OPENAI_STT_MODEL||"gpt-4o-transcribe");
 form.append("response_format",process.env.OPENAI_STT_RESPONSE_FORMAT||"json");
 if(body.language_mode && body.language_mode!=="auto" && body.language_mode!=="ar" && body.language_mode!=="en") form.append("language",body.language_mode);
 const r=await fetch(OPENAI_BASE+"/audio/transcriptions",{method:"POST",headers:{Authorization:"Bearer "+OPENAI_KEY},body:form});
 const raw=await r.text(); if(!r.ok) throw new Error("OpenAI transcription failed: "+raw.slice(0,800));
 const data=JSON.parse(raw);
 if(Array.isArray(data.segments)){
  return {provider:"openai",segments:data.segments.map((s,i)=>({id:String(s.id??i),speaker:s.speaker||"Speaker "+((i%2)+1),start_ms:Math.round(Number(s.start||0)*1000),end_ms:Math.round(Number(s.end||0)*1000),language:s.language||body.language_mode||"auto",text:s.text||"",confidence:s.confidence??null,final:true}))};
 }
 return {provider:"openai",segments:[{id:"openai-1",speaker:"Speaker 1",start_ms:0,end_ms:null,language:body.language_mode||"auto",text:data.text||"",confidence:null,final:true}]};
}
async function openAISummary(body){
 if(!OPENAI_KEY) throw new Error("OPENAI_API_KEY is not configured.");
 const prompt=JSON.stringify({meeting:body.meeting||{},segments:body.segments||[],transcript:body.transcript||{}});
 const instructions="You are a sales meeting intelligence engine. Return ONLY valid JSON. Extract only facts supported by the meeting. Never invent names, budgets, dates, competitors, decision makers, or commitments. Missing information must be exactly \"Not mentioned\". Buying signals, risk signals, objections, and important commercial facts must include evidence. Preserve Arabic/English meaning. Produce fields: executive_summary, meeting_details, participants, customer_context, needs, pain_points, requirements, objections, pricing_and_budget, competitors, decision_maker, authority, urgency, timeline, buying_stage, buying_signals, risk_signals, decisions, agreements, disagreements, open_questions, chronological_summary, customer_statements, customer_questions, salesperson_questions, responses_given, next_steps, crm_summary, follow_up_message.";
 const r=await fetch(OPENAI_BASE+"/responses",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+OPENAI_KEY},body:JSON.stringify({model:process.env.OPENAI_SUMMARY_MODEL||"gpt-5.6-luna",instructions,input:prompt,text:{format:{type:"json_object"}}})});
 const raw=await r.text(); if(!r.ok) throw new Error("OpenAI summary failed: "+raw.slice(0,800));
 const data=JSON.parse(raw);
 const output=data.output_text||data.output?.flatMap(x=>x.content||[]).map(x=>x.text||"").join("")||"{}";
 return JSON.parse(output);
}
async function remoteJSON(endpoint, apiKey, payload) {
  if (!endpoint) throw new Error("Provider endpoint is not configured.");
  const response = await fetch(endpoint, {
    method:"POST",
    headers: { "Content-Type":"application/json", ...(apiKey ? { Authorization:"Bearer " + apiKey } : {}) },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  if (!response.ok) throw new Error("Provider returned " + response.status + ": " + text.slice(0,500));
  return JSON.parse(text);
}

app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error:"audio file is required" });
    if ((process.env.STT_PROVIDER || "mock") === "openai") { return res.json(await openAITranscribe(req.file, req.body)); }
    if ((process.env.STT_PROVIDER || "mock") === "remote") {
      return res.json(await remoteJSON(process.env.STT_ENDPOINT, process.env.STT_API_KEY, {
        audio_base64:req.file.buffer.toString("base64"), mime_type:req.file.mimetype,
        language_mode:req.body.language_mode || "auto", dialect_hint:req.body.dialect_hint || null,
        session_id:req.body.session_id || null
      }));
    }
    res.json({ provider:"mock", segments:[{ id:"local-1", speaker:"Speaker 1", start_ms:0, end_ms:null, language:req.body.language_mode || "auto", text:"Audio uploaded successfully. Configure a production STT provider to receive the real transcript.", confidence:null, final:true }], note:"Mock transcription is active." });
  } catch (error) { res.status(502).json({ error:error.message }); }
});

app.post("/api/sales-summary", async (req, res) => {
  try {
    if ((process.env.SUMMARY_PROVIDER || "mock") === "openai") { return res.json(await openAISummary(req.body)); }
    if ((process.env.SUMMARY_PROVIDER || "mock") === "remote") {
      return res.json(await remoteJSON(process.env.SUMMARY_ENDPOINT, process.env.SUMMARY_API_KEY, { meeting:req.body.meeting || {}, transcript:req.body.transcript || "", segments:req.body.segments || [] }));
    }
    res.json(buildEnhancedMockSummary(req.body));
  } catch (error) { res.status(502).json({ error:error.message }); }
});

app.listen(PORT, () => console.log("Smart Sales Assistant running on http://localhost:" + PORT));
