const $=s=>document.querySelector(s);
const transcriptEl=$("#transcript");
let recognition=null,recording=false,source="mic",audioStream=null,recorder=null,audioChunks=[],transcriptSegments=[],speakerNames={},sessionId=crypto.randomUUID();

const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
function setStatus(t,live=false){$("#statusText").textContent=t;document.querySelector(".recording-indicator").classList.toggle("live",live)}
function setSummaryMessage(message,empty=true){const box=$("#summary");box.classList.toggle("empty",empty);box.textContent=message}
function appendFinal(t){
  if(!t.trim())return;
  const speaker=source==="device"?"Speaker 2":"Speaker 1";
  transcriptSegments.push({id:crypto.randomUUID(),speaker,start_ms:Date.now(),end_ms:null,language:$("#dialect").value,text:t.trim(),confidence:null,final:true});
  renderTranscriptSegments();renderSpeakerMap();
}
function setupRecognition(){
  if(!SpeechRecognition){setStatus("المتصفح لا يدعم Live Speech Recognition");return null}
  const r=new SpeechRecognition();r.continuous=true;r.interimResults=true;r.lang=$("#dialect").value;r.maxAlternatives=1;
  r.onresult=e=>{let interim="";for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)appendFinal(t);else interim+=t}renderTranscriptSegments(interim)};
  r.onerror=e=>setStatus(e.error==="not-allowed"?"تم رفض إذن الميكروفون/التعرف الصوتي.":e.error==="no-speech"?"لم يتم اكتشاف كلام.":"خطأ في التعرف الصوتي: "+e.error,recording);
  r.onend=()=>{if(recording){try{r.start()}catch(_){}}};
  return r;
}
async function start(){
  if(recording)return;
  if(!navigator.mediaDevices?.getUserMedia){alert("المتصفح لا يدعم الوصول إلى الميكروفون.");return}
  recording=true;$("#startBtn").disabled=true;$("#stopBtn").disabled=false;setStatus("جاري التسجيل والتفريغ…",true);setSummaryMessage("التسجيل مستمر. أنشئ الملخص بعد الإيقاف.",true);
  try{
    audioStream=source==="mic"?await navigator.mediaDevices.getUserMedia({audio:true}):await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});
    audioChunks=[];
    if(window.MediaRecorder){recorder=new MediaRecorder(audioStream);recorder.ondataavailable=e=>{if(e.data.size)audioChunks.push(e.data)};recorder.start(1000)}
    recognition=setupRecognition();if(recognition)try{recognition.start()}catch(_){}
    audioStream.getAudioTracks().forEach(t=>t.addEventListener("ended",()=>{if(recording)stop()}));
  }catch(e){recording=false;$("#startBtn").disabled=false;$("#stopBtn").disabled=true;setStatus("لم يتم تشغيل التسجيل");alert("تعذر الوصول للصوت: "+(e.message||e))}
}
async function uploadRecording(){
  if(!audioChunks.length)return;
  try{
    const health=await fetch("/api/health").then(r=>r.json());if(health.transcriptionProvider!=="remote")return;
    const blob=new Blob(audioChunks,{type:recorder?.mimeType||"audio/webm"}),form=new FormData();
    form.append("audio",blob,"meeting-"+sessionId+".webm");form.append("session_id",sessionId);form.append("language_mode",$("#language").value);form.append("dialect_hint",$("#dialect").value);
    const r=await fetch("/api/transcribe",{method:"POST",body:form});if(!r.ok)throw new Error(await r.text());
    const data=await r.json();if(Array.isArray(data.segments)){transcriptSegments=data.segments;renderSpeakerMap();renderTranscriptSegments()}
  }catch(e){console.warn("Optional remote transcription failed",e)}
}
function stop(){
  recording=false;$("#startBtn").disabled=false;$("#stopBtn").disabled=true;
  if(recognition){try{recognition.stop()}catch(_){}}
  if(recorder&&recorder.state!=="inactive")recorder.stop();
  setTimeout(uploadRecording,150);if(audioStream)audioStream.getTracks().forEach(t=>t.stop());setStatus("تم إيقاف التسجيل");
}
$("#startBtn").onclick=start;$("#stopBtn").onclick=stop;
$("#micBtn").onclick=()=>{if(recording)return;source="mic";$("#micBtn").classList.add("active");$("#deviceBtn").classList.remove("active")};
$("#deviceBtn").onclick=()=>{if(recording)return;source="device";$("#deviceBtn").classList.add("active");$("#micBtn").classList.remove("active")};
$("#dialect").onchange=()=>{if(recognition&&recording){try{recognition.stop()}catch(_){ }setTimeout(()=>{recognition=setupRecognition();if(recording)try{recognition.start()}catch(_){ }},150)}};
$("#copyBtn").onclick=async()=>{try{await navigator.clipboard.writeText($("#transcript").innerText);setStatus("تم نسخ الـTranscript")}catch(_){alert("تعذر النسخ تلقائياً.")}};
$("#clearBtn").onclick=()=>{if(!confirm("مسح الـTranscript الحالي؟"))return;transcriptSegments=[];speakerNames={};$("#transcript").textContent="";renderSpeakerMap();setSummaryMessage("بعد انتهاء التفريغ، اضغط «إنشاء Sales Summary».",true)};

function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function getMeta(){return{title:$("#meetingName").value||"Not mentioned",company:$("#company").value||"Not mentioned",industry:$("#industry").value||"Not mentioned",attendees:$("#attendees").value||"Not mentioned",pre_notes:$("#preNotes").value||""}}
async function buildSummary(){
  const t=transcriptSegments.map(s=>s.text||"").join(" ").trim()||$("#transcript").innerText.trim();if(!t){alert("أضف transcript أولاً.");return}
  const meta=getMeta();setSummaryMessage("جاري تجهيز Sales Summary…",true);
  try{
    const mappedSegments=transcriptSegments.map(s=>({...s,speaker:speakerNames[s.speaker]||s.speaker}));
    const r=await fetch("/api/sales-summary",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({meeting:meta,transcript:t,segments:mappedSegments})});
    if(r.ok){renderApiSummary(await r.json(),meta);return}
  }catch(e){console.warn("API summary unavailable; using local fallback.",e)}
  renderLocalSummary(t,meta);
}
function renderLocalSummary(t,meta){
  const sentences=t.split(/(?<=[.!؟?])\s+/).filter(Boolean),keys=["السعر","ميزانية","budget","price","cost","اعتراض","objection","مشكلة","problem","احتياج","need","موعد","timeline","start","يبدأ","قرار","decision","المنافس","competitor"];
  const signals=sentences.filter(x=>keys.some(k=>x.toLowerCase().includes(k.toLowerCase()))).slice(0,15),box=$("#summary");box.classList.remove("empty");
  box.innerHTML="<div class='summary-grid'><div class='kv'><strong>الاجتماع</strong>"+esc(meta.title)+"</div><div class='kv'><strong>الشركة</strong>"+esc(meta.company)+"</div><div class='kv'><strong>المجال</strong>"+esc(meta.industry)+"</div><div class='kv'><strong>الحاضرون</strong>"+esc(meta.attendees)+"</div></div><h4>Executive Sales Summary</h4><p>ملخص محلي مبدئي مبني على النص، بدون تخمين معلومات غير مذكورة.</p><h4>Key Sales Signals</h4><ul>"+(signals.length?signals.map(x=>"<li>"+esc(x)+"</li>").join(""):"<li>لم يتم استخراج إشارات تلقائياً — راجع النص الكامل.</li>")+"</ul><h4>CRM Follow-up</h4><ul><li><strong>Next Action:</strong> مراجعة النقاط المفتوحة والتواصل مع العميل.</li></ul>";
}
function renderSpeakerMap(){
  const el=$("#speakerMap"),speakers=[...new Set(transcriptSegments.map(s=>s.speaker).filter(Boolean))];
  if(!speakers.length){el.innerHTML="<p class='hint'>بعد التفريغ سيظهر Speaker 1 / Speaker 2 هنا.</p>";return}
  el.innerHTML=speakers.map(sp=>"<label>"+esc(sp)+"<input data-speaker='"+esc(sp)+"' value='"+esc(speakerNames[sp]||"")+"' placeholder='اسم الشخص (اختياري)'></label>").join("");
  el.querySelectorAll("input").forEach(i=>i.oninput=()=>{speakerNames[i.dataset.speaker]=i.value.trim();renderTranscriptSegments()});
}
function renderTranscriptSegments(interim=""){
  if(!transcriptSegments.length){$("#transcript").textContent=interim;return}
  $("#transcript").innerHTML=transcriptSegments.map(s=>"<div><strong>"+esc(speakerNames[s.speaker]||s.speaker||"Speaker")+" </strong>"+esc(s.text)+"</div>").join("")+(interim?"<div><em>"+esc(interim)+"</em></div>");$("#transcript").scrollTop=$("#transcript").scrollHeight;
}
function renderApiSummary(data,meta){
  const box=$("#summary");box.classList.remove("empty");
  const value=v=>v===undefined||v===null||v===""||(Array.isArray(v)&&!v.length)?["Not mentioned"]:Array.isArray(v)?v:[v];
  const fmt=v=>typeof v==="string"?v:JSON.stringify(v,null,2);
  const section=(title,v)=>"<div class='summary-section'><h4>"+esc(title)+"</h4><ul>"+value(v).map(x=>"<li>"+esc(fmt(x))+"</li>").join("")+"</ul></div>";
  box.innerHTML="<div class='summary-grid'><div class='kv'><strong>الاجتماع</strong>"+esc(meta.title)+"</div><div class='kv'><strong>الشركة</strong>"+esc(meta.company)+"</div><div class='kv'><strong>المجال</strong>"+esc(meta.industry)+"</div><div class='kv'><strong>الحاضرون</strong>"+esc(meta.attendees)+"</div></div>"+section("Executive Summary",data.executive_summary)+section("Meeting Details",data.meeting_details)+section("Participants",data.participants)+section("Customer Context",data.customer_context)+section("Needs",data.needs)+section("Pain Points",data.pain_points)+section("Requirements",data.requirements)+section("Objections & Responses",data.objections)+section("Pricing & Budget",data.pricing_and_budget)+section("Competitors / Alternatives",data.competitors)+section("Buying Signals",data.buying_signals)+section("Risk Signals",data.risk_signals)+section("Decision Maker / Authority",data.decision_maker||data.authority)+section("Timeline / Urgency",data.timeline||data.urgency)+section("Decisions & Agreements",data.decisions||data.agreements)+section("Open Questions",data.open_questions)+section("Next Steps",data.next_steps)+section("CRM Summary",data.crm_summary)+section("Follow-up Message",data.follow_up_message);
}
$("#summaryBtn").onclick=buildSummary;
document.querySelectorAll("[data-ui-lang]").forEach(b=>b.onclick=()=>{document.documentElement.lang=b.dataset.uiLang;document.documentElement.dir=b.dataset.uiLang==="ar"?"rtl":"ltr";document.querySelectorAll("[data-ui-lang]").forEach(x=>x.classList.remove("active"));b.classList.add("active")});

function meetingState(){return{sessionId,createdAt:new Date().toISOString(),meeting:getMeta(),language:$("#language").value,dialect:$("#dialect").value,segments:transcriptSegments,speakerNames,transcript:$("#transcript").innerText,summary:$("#summary").innerText}}
function saveMeeting(){
  const state=meetingState();let history=[];try{history=JSON.parse(localStorage.getItem("smartSalesMeetings")||"[]")}catch(_){}
  history=[state,...history.filter(x=>x.sessionId!==state.sessionId)].slice(0,50);localStorage.setItem("smartSalesMeetings",JSON.stringify(history));localStorage.setItem("smartSalesMeeting",JSON.stringify(state));setStatus("تم حفظ الاجتماع على هذا الجهاز");
}
function downloadFile(name,type,text){const a=document.createElement("a"),url=URL.createObjectURL(new Blob([text],{type}));a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500)}
function exportJSON(){downloadFile("sales-meeting.json","application/json",JSON.stringify(meetingState(),null,2))}
function exportMarkdown(){const m=meetingState(),md="# Sales Meeting\n\n## Meeting\n- Title: "+m.meeting.title+"\n- Company: "+m.meeting.company+"\n- Industry: "+m.meeting.industry+"\n- Attendees: "+m.meeting.attendees+"\n\n## Transcript\n\n"+(m.transcript||"Not mentioned")+"\n\n## CRM Summary\n\n"+(m.summary||"Not generated");downloadFile("sales-meeting.md","text/markdown",md)}
function copySummary(){try{navigator.clipboard.writeText($("#summary").innerText);setStatus("تم نسخ Sales Summary")}catch(_){alert("تعذر النسخ تلقائياً.")}}
$("#saveBtn").onclick=saveMeeting;$("#exportBtn").onclick=exportJSON;$("#exportMdBtn").onclick=exportMarkdown;$("#copySummaryBtn")?.addEventListener("click",copySummary);
function restoreMeeting(){try{const m=JSON.parse(localStorage.getItem("smartSalesMeeting")||"null");if(!m)return;const x=m.meeting||{};$("#meetingName").value=x.title==="Not mentioned"?"":x.title||"";$("#company").value=x.company==="Not mentioned"?"":x.company||"";$("#industry").value=x.industry==="Not mentioned"?"":x.industry||"";$("#attendees").value=x.attendees==="Not mentioned"?"":x.attendees||"";$("#preNotes").value=x.pre_notes||"";transcriptSegments=m.segments||[];speakerNames=m.speakerNames||{};renderTranscriptSegments();renderSpeakerMap()}catch(e){console.warn("restore failed",e)}}
window.addEventListener("load",restoreMeeting);