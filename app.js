const $=s=>document.querySelector(s);
const transcriptEl=$("#transcript");
let recognition=null,recording=false,source="mic",finalText="",audioStream=null,recorder=null,audioChunks=[],transcriptSegments=[],speakerNames={},sessionId=crypto.randomUUID();

const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
function setStatus(t,live=false){$("#statusText").textContent=t;document.querySelector(".recording-indicator").classList.toggle("live",live)}
function appendFinal(t){if(!t.trim())return;const speaker=source==="device"?"Speaker 2":"Speaker 1";transcriptSegments.push({id:crypto.randomUUID(),speaker,start_ms:Date.now(),end_ms:null,language:$("#dialect").value,text:t.trim(),confidence:null,final:true});finalText+=(finalText?" ":"")+t.trim();transcriptEl.textContent=finalText;renderSpeakerMap()}
function appendInterim(t){transcriptEl.textContent=finalText+(finalText?" ":"")+t.trim();transcriptEl.scrollTop=transcriptEl.scrollHeight}

function setupRecognition(){
 if(!SpeechRecognition){setStatus("المتصفح لا يدعم Live Speech Recognition");return null}
 const r=new SpeechRecognition();r.continuous=true;r.interimResults=true;r.lang=$("#dialect").value;r.maxAlternatives=1;
 r.onresult=e=>{let interim="";for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)appendFinal(t);else interim+=t}if(interim)appendInterim(interim)};
 r.onerror=e=>setStatus("خطأ في التعرف الصوتي: "+e.error);
 r.onend=()=>{if(recording){try{r.start()}catch(_){}}};return r;
}
async function start(){
 if(recording)return;recording=true;$("#startBtn").disabled=true;$("#stopBtn").disabled=false;setStatus("جاري التسجيل والتفريغ…",true);
 try{
  audioStream=source==="mic"?await navigator.mediaDevices.getUserMedia({audio:true}):await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});
  audioChunks=[];recorder=new MediaRecorder(audioStream);recorder.ondataavailable=e=>{if(e.data.size)audioChunks.push(e.data)};recorder.start(1000);recognition=setupRecognition();if(recognition){try{source==="device"&&audioStream.getAudioTracks()[0]?recognition.start(audioStream.getAudioTracks()[0]):recognition.start()}catch(_){recognition.start()}}
 }catch(e){recording=false;$("#startBtn").disabled=false;$("#stopBtn").disabled=true;setStatus("لم يتم تشغيل التسجيل");alert("تعذر الوصول للصوت: "+e.message)}
}
async function uploadRecording(){if(!audioChunks.length)return;try{const health=await fetch("/api/health").then(r=>r.json());if(health.transcriptionProvider!=="remote")return;const blob=new Blob(audioChunks,{type:recorder?.mimeType||"audio/webm"});const form=new FormData();form.append("audio",blob,"meeting-"+sessionId+".webm");form.append("session_id",sessionId);form.append("language_mode",$("#language").value);form.append("dialect_hint",$("#dialect").value);const r=await fetch("/api/transcribe",{method:"POST",body:form});if(!r.ok)throw new Error(await r.text());const data=await r.json();if(Array.isArray(data.segments)){transcriptSegments=data.segments;renderSpeakerMap();renderTranscriptSegments();}}catch(e){console.error("Transcription upload failed",e)}}
function stop(){recording=false;$("#startBtn").disabled=false;$("#stopBtn").disabled=true;if(recognition){try{recognition.stop()}catch(_){}}if(recorder&&recorder.state!=="inactive")recorder.stop();setTimeout(uploadRecording,150);if(audioStream)audioStream.getTracks().forEach(t=>t.stop());setStatus("تم إيقاف التسجيل")}
$("#startBtn").onclick=start;$("#stopBtn").onclick=stop;
$("#micBtn").onclick=()=>{source="mic";$("#micBtn").classList.add("active");$("#deviceBtn").classList.remove("active")};
$("#deviceBtn").onclick=()=>{source="device";$("#deviceBtn").classList.add("active");$("#micBtn").classList.remove("active")};
$("#dialect").onchange=()=>{if(recognition&&recording){try{recognition.stop()}catch(_){ }setTimeout(()=>{recognition=setupRecognition();if(recording)recognition.start()},150)}};
$("#copyBtn").onclick=()=>navigator.clipboard.writeText(transcriptEl.innerText);
$("#clearBtn").onclick=()=>{finalText="";transcriptEl.textContent=""};

function esc(s){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
async function buildSummary(){
 const t=transcriptEl.innerText.trim();if(!t){alert("أضف transcript أولاً.");return}
 const meta={title:$("#meetingName").value||"غير محدد",company:$("#company").value||"غير محدد",industry:$("#industry").value||"غير محدد",attendees:$("#attendees").value||"غير محدد",pre_notes:$("#preNotes").value||""};
 try{transcriptSegments=transcriptSegments.map(s=>({...s,speaker:speakerNames[s.speaker]||s.speaker}));finalText=transcriptSegments.map(s=>s.text).join(" ").trim();renderTranscriptSegments();const r=await fetch("/api/sales-summary",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({meeting:meta,transcript:t,segments:transcriptSegments})});if(r.ok){const data=await r.json();renderApiSummary(data,meta);return}}catch(e){console.warn("API summary unavailable; using local fallback.",e)}
 const sentences=t.split(/(?<=[.!؟?])\s+/).filter(Boolean);
 const keys=["السعر","ميزانية","budget","price","cost","اعتراض","objection","مشكلة","problem","احتياج","need","موعد","timeline","start","يبدأ","قرار","decision","المنافس","competitor"];
 const signals=sentences.filter(x=>keys.some(k=>x.toLowerCase().includes(k.toLowerCase()))).slice(0,15);
 const list=signals.length?signals.map(x=>"<li>"+esc(x)+"</li>").join(""):"<li>لم يتم استخراج إشارات تلقائياً — راجع النص الكامل.</li>";
 const box=$("#summary");box.classList.remove("empty");
 box.innerHTML="<div class='summary-grid'>"+
 "<div class='kv'><strong>الاجتماع</strong>"+esc(meta.title)+"</div>"+
 "<div class='kv'><strong>الشركة</strong>"+esc(meta.company)+"</div>"+
 "<div class='kv'><strong>المجال</strong>"+esc(meta.industry)+"</div>"+
 "<div class='kv'><strong>الحاضرون</strong>"+esc(meta.attendees)+"</div></div>"+
 "<h4>Executive Sales Summary</h4><p>تم تجهيز ملخص مبدئي من الـtranscript والبيانات المدخلة.</p>"+
 "<h4>Key Sales Signals</h4><ul>"+list+"</ul>"+
 "<h4>CRM Follow-up</h4><ul><li><strong>Next Action:</strong> مراجعة النقاط المفتوحة والتواصل مع العميل.</li><li><strong>Transcript:</strong> النص الكامل محفوظ بالأعلى.</li></ul>";
}
function renderSpeakerMap(){const el=$("#speakerMap");const speakers=[...new Set(transcriptSegments.map(s=>s.speaker).filter(Boolean))];if(!speakers.length){el.innerHTML="<p class='hint'>لا توجد بيانات Speaker بعد.</p>";return}el.innerHTML=speakers.map(sp=>"<label>"+esc(sp)+"<input data-speaker='"+esc(sp)+"' placeholder='اسم الشخص (اختياري)'></label>").join("");el.querySelectorAll("input").forEach(i=>i.oninput=()=>{speakerNames[i.dataset.speaker]=i.value.trim()})}
function renderTranscriptSegments(){finalText=transcriptSegments.map(s=>s.text).join(" ").trim();transcriptEl.innerHTML=transcriptSegments.map(s=>"<div><strong>"+esc(speakerNames[s.speaker]||s.speaker||"Speaker")+" </strong>"+esc(s.text)+"</div>").join("")}
function renderApiSummary(data,meta){
 const box=$("#summary");box.classList.remove("empty");
 const value=v=>{if(v===undefined||v===null||v===""||(Array.isArray(v)&&!v.length))return ["Not mentioned"];return Array.isArray(v)?v:[v]};
 const fmt=v=>typeof v==="string"?v:JSON.stringify(v,null,2);
 const section=(title,v)=>"<div class='summary-section'><h4>"+esc(title)+"</h4><ul>"+value(v).map(x=>"<li>"+esc(fmt(x))+"</li>").join("")+"</ul></div>";
 const details="<div class='summary-grid'><div class='kv'><strong>الاجتماع</strong>"+esc(meta.title)+"</div><div class='kv'><strong>الشركة</strong>"+esc(meta.company)+"</div><div class='kv'><strong>المجال</strong>"+esc(meta.industry)+"</div><div class='kv'><strong>الحاضرون</strong>"+esc(meta.attendees)+"</div></div>";
 box.innerHTML=details+
 section("Executive Summary",data.executive_summary)+
 section("Meeting Details",data.meeting_details)+
 section("Participants",data.participants)+
 section("Customer Context",data.customer_context)+
 section("Needs",data.needs)+
 section("Pain Points",data.pain_points)+
 section("Requirements",data.requirements)+
 section("Objections & Responses",data.objections)+
 section("Pricing & Budget",data.pricing_and_budget)+
 section("Competitors / Alternatives",data.competitors)+
 section("Buying Signals",data.buying_signals)+
 section("Risk Signals",data.risk_signals)+
 section("Decision Maker / Authority",data.decision_maker||data.authority)+
 section("Timeline / Urgency",data.timeline||data.urgency)+
 section("Decisions & Agreements",data.decisions)+
 section("Open Questions",data.open_questions)+
 section("Next Steps",data.next_steps)+
 section("CRM Summary",data.crm_summary)+
 section("Follow-up Message",data.follow_up_message);
}
$("#summaryBtn").onclick=buildSummary;
document.querySelectorAll("[data-ui-lang]").forEach(b=>b.onclick=()=>{document.documentElement.lang=b.dataset.uiLang;document.documentElement.dir=b.dataset.uiLang==="ar"?"rtl":"ltr";document.querySelectorAll("[data-ui-lang]").forEach(x=>x.classList.remove("active"));b.classList.add("active")});