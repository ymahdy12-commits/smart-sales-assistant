const $=s=>document.querySelector(s);
const transcriptEl=$("#transcript");
let recognition=null,recording=false,source="mic",finalText="",audioStream=null,recorder=null;

const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
function setStatus(t,live=false){$("#statusText").textContent=t;document.querySelector(".recording-indicator").classList.toggle("live",live)}
function appendFinal(t){if(!t.trim())return;finalText+=(finalText?" ":"")+t.trim();transcriptEl.textContent=finalText}
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
  recorder=new MediaRecorder(audioStream);recorder.start(1000);recognition=setupRecognition();if(recognition)recognition.start();
 }catch(e){recording=false;$("#startBtn").disabled=false;$("#stopBtn").disabled=true;setStatus("لم يتم تشغيل التسجيل");alert("تعذر الوصول للصوت: "+e.message)}
}
function stop(){recording=false;$("#startBtn").disabled=false;$("#stopBtn").disabled=true;if(recognition){try{recognition.stop()}catch(_){}}if(recorder&&recorder.state!=="inactive")recorder.stop();if(audioStream)audioStream.getTracks().forEach(t=>t.stop());setStatus("تم إيقاف التسجيل")}
$("#startBtn").onclick=start;$("#stopBtn").onclick=stop;
$("#micBtn").onclick=()=>{source="mic";$("#micBtn").classList.add("active");$("#deviceBtn").classList.remove("active")};
$("#deviceBtn").onclick=()=>{source="device";$("#deviceBtn").classList.add("active");$("#micBtn").classList.remove("active")};
$("#dialect").onchange=()=>{if(recognition&&recording){try{recognition.stop()}catch(_){ }setTimeout(()=>{recognition=setupRecognition();if(recording)recognition.start()},150)}};
$("#copyBtn").onclick=()=>navigator.clipboard.writeText(transcriptEl.innerText);
$("#clearBtn").onclick=()=>{finalText="";transcriptEl.textContent=""};

function esc(s){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function buildSummary(){
 const t=transcriptEl.innerText.trim();if(!t){alert("أضف transcript أولاً.");return}
 const meta={meeting:$("#meetingName").value||"غير محدد",company:$("#company").value||"غير محدد",industry:$("#industry").value||"غير محدد",attendees:$("#attendees").value||"غير محدد"};
 const sentences=t.split(/(?<=[.!؟?])\s+/).filter(Boolean);
 const keys=["السعر","ميزانية","budget","price","cost","اعتراض","objection","مشكلة","problem","احتياج","need","موعد","timeline","start","يبدأ","قرار","decision","المنافس","competitor"];
 const signals=sentences.filter(x=>keys.some(k=>x.toLowerCase().includes(k.toLowerCase()))).slice(0,15);
 const list=signals.length?signals.map(x=>"<li>"+esc(x)+"</li>").join(""):"<li>لم يتم استخراج إشارات تلقائياً — راجع النص الكامل.</li>";
 const box=$("#summary");box.classList.remove("empty");
 box.innerHTML="<div class='summary-grid'>"+
 "<div class='kv'><strong>الاجتماع</strong>"+esc(meta.meeting)+"</div>"+
 "<div class='kv'><strong>الشركة</strong>"+esc(meta.company)+"</div>"+
 "<div class='kv'><strong>المجال</strong>"+esc(meta.industry)+"</div>"+
 "<div class='kv'><strong>الحاضرون</strong>"+esc(meta.attendees)+"</div></div>"+
 "<h4>Executive Sales Summary</h4><p>تم تجهيز ملخص مبدئي من الـtranscript والبيانات المدخلة.</p>"+
 "<h4>Key Sales Signals</h4><ul>"+list+"</ul>"+
 "<h4>CRM Follow-up</h4><ul><li><strong>Next Action:</strong> مراجعة النقاط المفتوحة والتواصل مع العميل.</li><li><strong>Transcript:</strong> النص الكامل محفوظ بالأعلى.</li></ul>";
}
$("#summaryBtn").onclick=buildSummary;
document.querySelectorAll("[data-ui-lang]").forEach(b=>b.onclick=()=>{document.documentElement.lang=b.dataset.uiLang;document.documentElement.dir=b.dataset.uiLang==="ar"?"rtl":"ltr";document.querySelectorAll("[data-ui-lang]").forEach(x=>x.classList.remove("active"));b.classList.add("active")});