import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app=express();
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||3000);
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:100*1024*1024}});
app.use(express.json({limit:"2mb"}));
app.use(express.static(__dirname));

app.get("/api/health",(_req,res)=>res.json({ok:true,service:"smart-sales-assistant",transcriptionProvider:process.env.STT_PROVIDER||"mock",summaryProvider:process.env.SUMMARY_PROVIDER||"mock"}));

function splitSentences(text){return String(text||"").split(/(?<=[.!؟?])\s+/).map(s=>s.trim()).filter(Boolean)}
function extractSignals(text){
  const sentences=splitSentences(text),buckets={
    needs:["need","needs","احتياج","محتاج","عايز","نحتاج","هدف"],
    painPoints:["problem","pain","مشكلة","معاناة","ضعف","مش شغال"],
    objections:["objection","غالي","سعر","ميزانية","budget","price","cost","مش مقتنع","متردد"],
    timeline:["timeline","متى","متى نبدأ","ابدأ","نبدأ","next month","هذا الأسبوع","الأسبوع الجاي"],
    competitors:["competitor","منافس","شركة ثانية","شركة تانية","agency","وكالة"],
    decision:["decision maker","صاحب القرار","المالك","الإدارة","المدير","موافقة"]
  };
  return Object.fromEntries(Object.entries(buckets).map(([key,terms])=>[key,sentences.filter(s=>terms.some(t=>s.toLowerCase().includes(t.toLowerCase()))).slice(0,10)]));
}
function ensureArray(v){return Array.isArray(v)&&v.length?v:["Not mentioned"]}
function evidenceItem(text,evidence){return{text:text||"Not mentioned",evidence:evidence||"Not mentioned"}}
function buildMockSummary(body){
  const meeting=body.meeting||{},transcript=String(body.transcript||""),signals=extractSignals(transcript);
  return {
    executive_summary:transcript?"Meeting with "+(meeting.company||"the customer")+". Local deterministic extraction is active; no paid AI service is required.":"No transcript was supplied.",
    meeting_details:{title:meeting.title||"Not mentioned",company:meeting.company||"Not mentioned",industry:meeting.industry||"Not mentioned",date_time:meeting.date_time||"Not mentioned"},
    participants:meeting.attendees||"Not mentioned",
    customer_context:{current_situation:"Not mentioned",business_model:"Not mentioned",existing_setup:"Not mentioned"},
    needs:signals.needs.length?signals.needs:["Not mentioned"],pain_points:signals.painPoints.length?signals.painPoints:["Not mentioned"],
    requirements:["Not mentioned"],objections:signals.objections.length?signals.objections:["Not mentioned"],pricing_and_budget:["Not mentioned"],
    competitors:signals.competitors.length?signals.competitors:["Not mentioned"],buying_signals:[],risk_signals:[],
    decisions:signals.decision.length?signals.decision:["Not mentioned"],open_questions:["Not mentioned"],
    next_steps:[{owner:"Not mentioned",action:"Review transcript and confirm missing commercial details.",deadline:"Not mentioned"}],
    crm_summary:transcript?(meeting.company||"Customer")+" — meeting completed. Review needs, objections, decision process and timeline before the next follow-up.":"Not mentioned",
    follow_up_message:"Not generated in free local mode."
  };
}
function buildEnhancedMockSummary(body){
  const base=buildMockSummary(body),transcript=String(body.transcript||""),segments=Array.isArray(body.segments)?body.segments:[];
  return {...base,
    customer_context:{current_situation:"Not mentioned",business_model:"Not mentioned",marketing_sales_setup:"Not mentioned",existing_tools:"Not mentioned",current_provider:"Not mentioned",previous_attempts:"Not mentioned",desired_outcome:"Not mentioned"},
    needs:ensureArray(base.needs).map(x=>evidenceItem(x,x==="Not mentioned"?"Not mentioned":x)),
    pain_points:ensureArray(base.pain_points).map(x=>evidenceItem(x,x==="Not mentioned"?"Not mentioned":x)),
    objections:ensureArray(base.objections).map(x=>({objection:x,response:"Not mentioned",evidence:x})),
    pricing_and_budget:{budget:"Not mentioned",pricing_discussed:"Not mentioned",price_sensitivity:"Not mentioned",scope:"Not mentioned",payment_constraints:"Not mentioned"},
    competitors:ensureArray(base.competitors),decision_maker:"Not mentioned",authority:"Not mentioned",urgency:"Not mentioned",timeline:"Not mentioned",buying_stage:"Not mentioned",
    buying_signals:[],risk_signals:[],agreements:["Not mentioned"],disagreements:["Not mentioned"],open_questions:["Not mentioned"],
    chronological_summary:segments.length?segments.map(s=>({speaker:s.speaker||"Speaker",start_ms:s.start_ms??"Not mentioned",text:s.text||"Not mentioned"})):splitSentences(transcript).map(text=>({speaker:"Not mentioned",start_ms:"Not mentioned",text})),
    customer_statements:["Not mentioned"],customer_questions:["Not mentioned"],salesperson_questions:["Not mentioned"],responses_given:["Not mentioned"],
    next_steps:[{owner:"Not mentioned",action:"Not mentioned",deadline:"Not mentioned"}]
  };
}
async function remoteJSON(endpoint,apiKey,payload){
  if(!endpoint)throw new Error("Provider endpoint is not configured.");
  const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",...(apiKey?{Authorization:"Bearer "+apiKey}:{})},body:JSON.stringify(payload)});
  const text=await response.text();if(!response.ok)throw new Error("Provider returned "+response.status+": "+text.slice(0,500));return JSON.parse(text);
}
app.post("/api/transcribe",upload.single("audio"),async(req,res)=>{
  try{
    if(!req.file)return res.status(400).json({error:"audio file is required"});
    if((process.env.STT_PROVIDER||"mock")==="remote")return res.json(await remoteJSON(process.env.STT_ENDPOINT,process.env.STT_API_KEY,{audio_base64:req.file.buffer.toString("base64"),mime_type:req.file.mimetype,language_mode:req.body.language_mode||"auto",dialect_hint:req.body.dialect_hint||null,session_id:req.body.session_id||null}));
    res.json({provider:"mock",segments:[{id:"local-1",speaker:"Speaker 1",start_ms:0,end_ms:null,language:req.body.language_mode||"auto",text:"Audio uploaded successfully. Configure a remote STT provider for server-side transcription.",confidence:null,final:true}],note:"Mock transcription is active."});
  }catch(error){res.status(502).json({error:error.message})}
});
app.post("/api/sales-summary",async(req,res)=>{
  try{
    if((process.env.SUMMARY_PROVIDER||"mock")==="remote")return res.json(await remoteJSON(process.env.SUMMARY_ENDPOINT,process.env.SUMMARY_API_KEY,{meeting:req.body.meeting||{},transcript:req.body.transcript||"",segments:req.body.segments||[]}));
    res.json(buildEnhancedMockSummary(req.body));
  }catch(error){res.status(502).json({error:error.message})}
});
app.listen(PORT,()=>console.log("Smart Sales Assistant running on http://localhost:"+PORT));