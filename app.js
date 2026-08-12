const STORAGE_KEY = "tradelog_entries_v2";

const form = document.getElementById("tradeForm");
const tradeList = document.getElementById("tradeList");
const emptyState = document.getElementById("emptyState");
const noResults = document.getElementById("noResults");
const countText = document.getElementById("countText");
const clearAllButton = document.getElementById("clearAll");

const searchText = document.getElementById("searchText");
const statusFilter = document.getElementById("statusFilter");
const categoryFilter = document.getElementById("categoryFilter");
const confidenceFilter = document.getElementById("confidenceFilter");
const resetFilters = document.getElementById("resetFilters");

const sellDialog = document.getElementById("sellDialog");
const sellForm = document.getElementById("sellForm");
const sellTradeId = document.getElementById("sellTradeId");
const sellTitle = document.getElementById("sellTitle");

const editDialog = document.getElementById("editDialog");
const editForm = document.getElementById("editForm");
const editSellSection = document.getElementById("editSellSection");

function todayString() {
  return new Date().toISOString().slice(0,10);
}

document.getElementById("buyDate").value = todayString();
document.getElementById("sellDate").value = todayString();

function loadTrades() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function saveTrades(trades) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

function escapeHtml(v) {
  return String(v ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function formatNumber(v) {
  return Number(v).toLocaleString("ja-JP",{maximumFractionDigits:2});
}

function formatDate(s) {
  if (!s) return "-";
  return new Date(s+"T00:00:00").toLocaleDateString("ja-JP");
}

function calcHoldingDays(buyDate,sellDate) {
  const a = new Date(buyDate+"T00:00:00");
  const b = new Date(sellDate+"T00:00:00");
  return Math.max(0, Math.round((b-a)/86400000));
}

function calcTradeMetrics(trade) {
  if (!trade.sell) return null;
  const buy = Number(trade.buyPrice);
  const sell = Number(trade.sell.price);
  const shares = Number(trade.shares);
  return {
    profit:(sell-buy)*shares,
    returnRate:((sell-buy)/buy)*100,
    holdingDays:calcHoldingDays(trade.buyDate,trade.sell.date)
  };
}

function makePerformanceRows(items,getKey) {
  const groups = {};
  items.forEach(item=>{
    const key = getKey(item);
    if (!key) return;
    if (!groups[key]) groups[key]={count:0,wins:0,totalReturn:0,totalProfit:0};
    groups[key].count++;
    if (item.profit>0) groups[key].wins++;
    groups[key].totalReturn += item.returnRate;
    groups[key].totalProfit += item.profit;
  });
  return groups;
}

function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1,Math.floor(rect.width*ratio));
  canvas.height = Math.max(1,Math.floor(260*ratio));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio,0,0,ratio,0,0);
  return {ctx,width:rect.width,height:260};
}

function drawAxes(ctx,width,height,padding,minY,maxY,suffix="") {
  ctx.clearRect(0,0,width,height);
  ctx.font = "12px Segoe UI, sans-serif";
  ctx.fillStyle="#687386";
  ctx.strokeStyle="#e7eaf0";
  const h=height-padding.top-padding.bottom;
  for(let i=0;i<=4;i++){
    const y=padding.top+h*i/4;
    const val=maxY-(maxY-minY)*i/4;
    ctx.beginPath(); ctx.moveTo(padding.left,y); ctx.lineTo(width-padding.right,y); ctx.stroke();
    ctx.fillText(`${val.toFixed(0)}${suffix}`,6,y+4);
  }
}

function renderProfitChart(metrics) {
  const canvas=document.getElementById("profitChart");
  const empty=document.getElementById("profitChartEmpty");
  const sorted=[...metrics].sort((a,b)=>(a.trade.sell?.date||"").localeCompare(b.trade.sell?.date||""));
  if(!sorted.length){canvas.style.display="none";empty.style.display="block";return;}
  canvas.style.display="block"; empty.style.display="none";

  let running=0;
  const cumulative=sorted.map(x=>running+=x.profit);
  const {ctx,width,height}=setupCanvas(canvas);
  const p={left:60,right:20,top:18,bottom:34};
  const min=Math.min(0,...cumulative), max=Math.max(0,...cumulative), range=max-min||1;
  const minY=min-range*.1, maxY=max+range*.1;
  drawAxes(ctx,width,height,p,minY,maxY,"円");
  const cw=width-p.left-p.right, ch=height-p.top-p.bottom;

  ctx.strokeStyle="#1d2433"; ctx.lineWidth=2; ctx.beginPath();
  cumulative.forEach((v,i)=>{
    const x=p.left+(sorted.length===1?cw/2:cw*i/(sorted.length-1));
    const y=p.top+(maxY-v)/(maxY-minY)*ch;
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  });
  ctx.stroke();
}

function renderCategoryChart(metrics) {
  const canvas=document.getElementById("categoryChart");
  const empty=document.getElementById("categoryChartEmpty");
  const groups=makePerformanceRows(metrics,x=>x.trade.category||"その他");
  const data=Object.entries(groups).map(([name,g])=>({name,avg:g.totalReturn/g.count})).sort((a,b)=>b.avg-a.avg);
  if(!data.length){canvas.style.display="none";empty.style.display="block";return;}
  canvas.style.display="block"; empty.style.display="none";

  const {ctx,width,height}=setupCanvas(canvas);
  const p={left:56,right:18,top:18,bottom:60};
  const vals=data.map(x=>x.avg);
  const min=Math.min(0,...vals), max=Math.max(0,...vals), range=max-min||1;
  const minY=min-range*.15, maxY=max+range*.15;
  drawAxes(ctx,width,height,p,minY,maxY,"%");

  const cw=width-p.left-p.right, ch=height-p.top-p.bottom;
  const slot=cw/data.length, barW=Math.min(56,slot*.58);
  const zeroY=p.top+(maxY)/(maxY-minY)*ch;

  data.forEach((item,i)=>{
    const x=p.left+slot*i+slot/2-barW/2;
    const y=p.top+(maxY-item.avg)/(maxY-minY)*ch;
    const top=Math.min(y,zeroY);
    const bh=Math.max(2,Math.abs(zeroY-y));
    ctx.fillStyle=item.avg>=0?"#1d2433":"#8a94a6";
    ctx.fillRect(x,top,barW,bh);
    ctx.fillStyle="#4c566a";
    const label=item.name.length>6?item.name.slice(0,6)+"…":item.name;
    const tw=ctx.measureText(label).width;
    ctx.fillText(label,x+barW/2-tw/2,height-28);
  });
}

function renderInsights(metrics) {
  const list=document.getElementById("insightList"),count=document.getElementById("insightCount");
  if(metrics.length<3){list.innerHTML=`<p class="muted">売却済みの取引が3件以上になると、自動分析を始めます。現在は ${metrics.length}件です。</p>`;count.textContent=`${metrics.length}/3件`;return;}
  const insights=[];
  const avg=a=>a.reduce((s,x)=>s+x.returnRate,0)/a.length;
  const cats=Object.entries(makePerformanceRows(metrics,x=>x.trade.category||"その他")).filter(([,d])=>d.count>=2).map(([name,d])=>({name,count:d.count,avg:d.totalReturn/d.count,win:d.wins/d.count*100}));
  if(cats.length){const best=[...cats].sort((a,b)=>b.avg-a.avg)[0],worst=[...cats].sort((a,b)=>a.avg-b.avg)[0];if(best.avg>0)insights.push({title:`「${best.name}」が比較的得意`,text:`平均利益率 ${best.avg.toFixed(2)}%、勝率 ${best.win.toFixed(1)}%（${best.count}件）。`});if(worst.avg<0&&worst.name!==best.name)insights.push({title:`「${worst.name}」は要注意`,text:`平均利益率 ${worst.avg.toFixed(2)}%（${worst.count}件）。`});}
  const high=metrics.filter(x=>Number(x.trade.confidence)>=4),low=metrics.filter(x=>Number(x.trade.confidence)<=3);
  if(high.length>=2&&low.length>=2&&Math.abs(avg(high)-avg(low))>=2){insights.push({title:avg(high)<avg(low)?"自信が強い取引ほど慎重に":"高自信度の判断が結果につながっています",text:`自信度4〜5は ${avg(high).toFixed(2)}%、1〜3は ${avg(low).toFixed(2)}%。`});}
  const rules=metrics.map(x=>{const v=[x.trade.sell?.stopRuleKept,x.trade.sell?.sellRuleKept].filter(y=>y==="はい"||y==="いいえ");return v.length?{...x,kept:v.every(y=>y==="はい")}:null}).filter(Boolean);
  const kept=rules.filter(x=>x.kept),broken=rules.filter(x=>!x.kept);
  if(kept.length>=2&&broken.length>=2){insights.push({title:avg(kept)>avg(broken)?"ルールを守った取引の方が好成績":"ルール自体を見直す余地があります",text:`遵守時 ${avg(kept).toFixed(2)}%、非遵守時 ${avg(broken).toFixed(2)}%。`});}
  const short=metrics.filter(x=>x.holdingDays<=7),long=metrics.filter(x=>x.holdingDays>=8);
  if(short.length>=2&&long.length>=2&&Math.abs(avg(short)-avg(long))>=2){insights.push({title:avg(short)>avg(long)?"短期保有の方が相性良好":"長めの保有の方が相性良好",text:`7日以内 ${avg(short).toFixed(2)}%、8日以上 ${avg(long).toFixed(2)}%。`});}
  if(!insights.length)insights.push({title:"まだ強いクセは見つかっていません",text:"取引数が増えるほど、自信度・保有期間・ルール遵守などの差が見えやすくなります。"});
  count.textContent=`${insights.length}件の気づき`;list.innerHTML=insights.slice(0,6).map(x=>`<div class="insight-item"><strong>${escapeHtml(x.title)}</strong><span>${escapeHtml(x.text)}</span></div>`).join("");
}

function performanceTableHtml(rows){
  if(!rows.length)return "データがありません。";
  return `<div class="mini-performance">${rows.map(r=>`<div class="mini-row"><span>${escapeHtml(r.label)}</span><strong class="${r.avg>=0?"positive":"negative"}">${r.avg>=0?"+":""}${r.avg.toFixed(2)}%</strong><small>${r.count}件 / 勝率 ${r.winRate.toFixed(0)}%</small></div>`).join("")}</div>`;
}
function renderDeepAnalysis(metrics){
  const toRows=(g,order)=>order.filter(k=>g[k]).map(k=>{const d=g[k];return{label:k,count:d.count,avg:d.totalReturn/d.count,winRate:d.wins/d.count*100}});
  const cg=makePerformanceRows(metrics,x=>String(x.trade.confidence||""));
  document.getElementById("confidenceSummary").innerHTML=performanceTableHtml(toRows(cg,["1","2","3","4","5"]).map(x=>({...x,label:`自信度 ${x.label}`})));
  const bucket=x=>x.holdingDays<=3?"0〜3日":x.holdingDays<=7?"4〜7日":x.holdingDays<=30?"8〜30日":"31日以上";
  const hg=makePerformanceRows(metrics,bucket);
  document.getElementById("holdingSummary").innerHTML=performanceTableHtml(toRows(hg,["0〜3日","4〜7日","8〜30日","31日以上"]));
  const rr=metrics.map(x=>{const v=[x.trade.sell?.stopRuleKept,x.trade.sell?.sellRuleKept].filter(y=>y==="はい"||y==="いいえ");return v.length?{...x,rule:v.every(y=>y==="はい")?"ルール遵守":"ルール非遵守"}:null}).filter(Boolean);
  const rg=makePerformanceRows(rr,x=>x.rule);
  document.getElementById("rulePerformanceSummary").innerHTML=performanceTableHtml(toRows(rg,["ルール遵守","ルール非遵守"]));
}
function renderDashboard(trades) {
  const closed=trades.filter(t=>t.sell);
  const metrics=closed.map(t=>({trade:t,...calcTradeMetrics(t)}));
  document.getElementById("totalTrades").textContent=trades.length;
  document.getElementById("closedTrades").textContent=closed.length;

  renderProfitChart(metrics);
  renderCategoryChart(metrics);
  renderInsights(metrics);
  renderDeepAnalysis(metrics);

  if(!closed.length){
    document.getElementById("winRate").textContent="-";
    document.getElementById("totalProfit").textContent="-";
    document.getElementById("avgReturn").textContent="-";
    document.getElementById("predictionSummary").textContent="データがありません。";
    document.getElementById("ruleSummary").textContent="データがありません。";
    return;
  }

  const wins=metrics.filter(x=>x.profit>0).length;
  const totalProfit=metrics.reduce((s,x)=>s+x.profit,0);
  const avgReturn=metrics.reduce((s,x)=>s+x.returnRate,0)/metrics.length;

  document.getElementById("winRate").textContent=`${(wins/metrics.length*100).toFixed(1)}%`;
  const tp=document.getElementById("totalProfit");
  tp.textContent=`${totalProfit>=0?"+":""}${formatNumber(totalProfit)}円`;
  tp.className=totalProfit>=0?"positive":"negative";

  const ar=document.getElementById("avgReturn");
  ar.textContent=`${avgReturn>=0?"+":""}${avgReturn.toFixed(2)}%`;
  ar.className=avgReturn>=0?"positive":"negative";

  const pc={"○":0,"△":0,"×":0};
  closed.forEach(t=>{ if(pc[t.sell?.predictionResult]!==undefined) pc[t.sell.predictionResult]++; });
  const pt=pc["○"]+pc["△"]+pc["×"];
  document.getElementById("predictionSummary").innerHTML=pt?`
    <p><strong>○ 当たった：</strong>${pc["○"]}件 (${(pc["○"]/pt*100).toFixed(1)}%)</p>
    <p><strong>△ 半分：</strong>${pc["△"]}件 (${(pc["△"]/pt*100).toFixed(1)}%)</p>
    <p><strong>× 外れた：</strong>${pc["×"]}件 (${(pc["×"]/pt*100).toFixed(1)}%)</p>`:"データがありません。";

  let kept=0,broken=0;
  closed.forEach(t=>{
    const a=[t.sell?.stopRuleKept,t.sell?.sellRuleKept].filter(v=>v==="はい"||v==="いいえ");
    if(!a.length)return;
    if(a.every(v=>v==="はい"))kept++;else broken++;
  });

  document.getElementById("ruleSummary").innerHTML=(kept+broken)?`
    <p><strong>ルール遵守率：</strong>${(kept/(kept+broken)*100).toFixed(1)}%</p>
    <p><strong>守れた取引：</strong>${kept}件</p>
    <p><strong>破った取引：</strong>${broken}件</p>`:"データがありません。";
}

function getFilteredTrades(trades){
  const q=searchText.value.trim().toLowerCase();
  return trades.filter(t=>{
    const matchText=!q || `${t.symbol} ${t.reason} ${t.sell?.reason||""} ${t.sell?.reflection||""}`.toLowerCase().includes(q);
    const matchStatus=statusFilter.value==="all" ||
      (statusFilter.value==="open" && !t.sell) ||
      (statusFilter.value==="closed" && !!t.sell);
    const matchCategory=categoryFilter.value==="all" || t.category===categoryFilter.value;
    const matchConfidence=confidenceFilter.value==="all" || String(t.confidence)===confidenceFilter.value;
    return matchText && matchStatus && matchCategory && matchConfidence;
  });
}

function renderTrades() {
  const trades=loadTrades();
  renderDashboard(trades);

  const filtered=getFilteredTrades(trades);
  countText.textContent=`${filtered.length}件 / 全${trades.length}件`;
  emptyState.style.display=trades.length===0?"block":"none";
  noResults.style.display=trades.length>0 && filtered.length===0?"block":"none";

  tradeList.innerHTML=filtered.map(trade=>{
    const isClosed=!!trade.sell;
    let resultHtml="";
    if(isClosed){
      const r=calcTradeMetrics(trade);
      const cls=r.profit>=0?"positive":"negative";
      resultHtml=`
        <div class="result-box">
          <div class="result-grid">
            <div class="metric"><strong>売値</strong><span>${formatNumber(trade.sell.price)}円</span></div>
            <div class="metric"><strong>損益</strong><span class="${cls}">${r.profit>=0?"+":""}${formatNumber(r.profit)}円</span></div>
            <div class="metric"><strong>利益率</strong><span class="${cls}">${r.returnRate>=0?"+":""}${r.returnRate.toFixed(2)}%</span></div>
            <div class="metric"><strong>保有日数</strong><span>${r.holdingDays}日</span></div>
          </div>
          <div class="rules">
            <div class="rule-box"><strong>売却日</strong>${formatDate(trade.sell.date)}</div>
            <div class="rule-box"><strong>当初の予想</strong>${escapeHtml(trade.sell.predictionResult||"-")}</div>
          </div>
          ${trade.sell.reason?`<p class="reflection"><strong>売った理由：</strong>${escapeHtml(trade.sell.reason)}</p>`:""}
          ${trade.sell.reflection?`<p class="reflection"><strong>反省・学び：</strong>${escapeHtml(trade.sell.reflection)}</p>`:""}
        </div>`;
    }

    return `
      <article class="trade-item">
        <div class="trade-top">
          <div>
            <h3 class="trade-title">${escapeHtml(trade.symbol)}</h3>
            <p class="trade-meta">買付日：${formatDate(trade.buyDate)} ／ 買値：${formatNumber(trade.buyPrice)}円 ／ ${formatNumber(trade.shares)}株</p>
          </div>
          <span class="trade-date">${escapeHtml(trade.createdAt)}</span>
        </div>

        <div class="badges">
          <span class="badge ${isClosed?"closed":"open"}">${isClosed?"売却済み":"保有中"}</span>
          <span class="badge">${escapeHtml(trade.category)}</span>
          <span class="badge">自信度 ${"★".repeat(Number(trade.confidence))}${"☆".repeat(5-Number(trade.confidence))}</span>
        </div>

        <p class="trade-reason">${escapeHtml(trade.reason)}</p>

        <div class="rules">
          <div class="rule-box"><strong>損切り条件</strong>${escapeHtml(trade.stopLoss||"未設定")}</div>
          <div class="rule-box"><strong>売却条件</strong>${escapeHtml(trade.sellRule||"未設定")}</div>
        </div>

        ${resultHtml}

        <div class="actions">
          ${!isClosed?`<button class="sell-btn" data-sell-id="${trade.id}" type="button">売却結果を登録</button>`:""}
          <button class="edit-btn" data-edit-id="${trade.id}" type="button">編集</button>
          <button class="delete-btn" data-delete-id="${trade.id}" type="button">この記録を削除</button>
        </div>
      </article>`;
  }).join("");
}

form.addEventListener("submit",e=>{
  e.preventDefault();
  const trade={
    id:crypto.randomUUID(),
    symbol:document.getElementById("symbol").value.trim(),
    buyDate:document.getElementById("buyDate").value,
    buyPrice:document.getElementById("buyPrice").value,
    shares:document.getElementById("shares").value,
    reason:document.getElementById("reason").value.trim(),
    category:document.getElementById("category").value,
    confidence:document.getElementById("confidence").value,
    stopLoss:document.getElementById("stopLoss").value.trim(),
    sellRule:document.getElementById("sellRule").value.trim(),
    createdAt:new Date().toLocaleString("ja-JP"),
    sell:null
  };
  const trades=loadTrades();
  trades.unshift(trade);
  saveTrades(trades);
  form.reset();
  document.getElementById("buyDate").value=todayString();
  document.getElementById("confidence").value="3";
  renderTrades();
});

tradeList.addEventListener("click",e=>{
  const sellBtn=e.target.closest("[data-sell-id]");
  if(sellBtn){
    const t=loadTrades().find(x=>x.id===sellBtn.dataset.sellId);
    if(!t)return;
    sellTradeId.value=t.id;
    sellTitle.textContent=`${t.symbol} の売却結果`;
    document.getElementById("sellDate").value=todayString();
    document.getElementById("sellPrice").value="";
    document.getElementById("sellReason").value="";
    document.getElementById("predictionResult").value="○";
    document.getElementById("stopRuleKept").value="該当なし";
    document.getElementById("sellRuleKept").value="はい";
    document.getElementById("reflection").value="";
    sellDialog.showModal();
    return;
  }

  const editBtn=e.target.closest("[data-edit-id]");
  if(editBtn){
    const t=loadTrades().find(x=>x.id===editBtn.dataset.editId);
    if(!t)return;
    document.getElementById("editTradeId").value=t.id;
    document.getElementById("editSymbol").value=t.symbol;
    document.getElementById("editBuyDate").value=t.buyDate;
    document.getElementById("editBuyPrice").value=t.buyPrice;
    document.getElementById("editShares").value=t.shares;
    document.getElementById("editReason").value=t.reason;
    document.getElementById("editCategory").value=t.category||"その他";
    document.getElementById("editConfidence").value=t.confidence||"3";
    document.getElementById("editStopLoss").value=t.stopLoss||"";
    document.getElementById("editSellRule").value=t.sellRule||"";

    editSellSection.style.display=t.sell?"grid":"none";
    if(t.sell){
      document.getElementById("editSellDate").value=t.sell.date||"";
      document.getElementById("editSellPrice").value=t.sell.price||"";
      document.getElementById("editSellReason").value=t.sell.reason||"";
      document.getElementById("editPredictionResult").value=t.sell.predictionResult||"○";
      document.getElementById("editStopRuleKept").value=t.sell.stopRuleKept||"該当なし";
      document.getElementById("editSellRuleKept").value=t.sell.sellRuleKept||"はい";
      document.getElementById("editReflection").value=t.sell.reflection||"";
    }
    editDialog.showModal();
    return;
  }

  const del=e.target.closest("[data-delete-id]");
  if(del){
    const t=loadTrades().find(x=>x.id===del.dataset.deleteId);
    if(!confirm(`${t?.symbol||"この取引"} を削除しますか？`)) return;
    saveTrades(loadTrades().filter(x=>x.id!==del.dataset.deleteId));
    renderTrades();
  }
});

sellForm.addEventListener("submit",e=>{
  e.preventDefault();
  const trades=loadTrades();
  const t=trades.find(x=>x.id===sellTradeId.value);
  if(!t)return;
  t.sell={
    date:document.getElementById("sellDate").value,
    price:document.getElementById("sellPrice").value,
    reason:document.getElementById("sellReason").value.trim(),
    predictionResult:document.getElementById("predictionResult").value,
    stopRuleKept:document.getElementById("stopRuleKept").value,
    sellRuleKept:document.getElementById("sellRuleKept").value,
    reflection:document.getElementById("reflection").value.trim()
  };
  saveTrades(trades);
  sellDialog.close();
  renderTrades();
});

editForm.addEventListener("submit",e=>{
  e.preventDefault();
  const trades=loadTrades();
  const t=trades.find(x=>x.id===document.getElementById("editTradeId").value);
  if(!t)return;

  t.symbol=document.getElementById("editSymbol").value.trim();
  t.buyDate=document.getElementById("editBuyDate").value;
  t.buyPrice=document.getElementById("editBuyPrice").value;
  t.shares=document.getElementById("editShares").value;
  t.reason=document.getElementById("editReason").value.trim();
  t.category=document.getElementById("editCategory").value;
  t.confidence=document.getElementById("editConfidence").value;
  t.stopLoss=document.getElementById("editStopLoss").value.trim();
  t.sellRule=document.getElementById("editSellRule").value.trim();

  if(t.sell){
    t.sell.date=document.getElementById("editSellDate").value;
    t.sell.price=document.getElementById("editSellPrice").value;
    t.sell.reason=document.getElementById("editSellReason").value.trim();
    t.sell.predictionResult=document.getElementById("editPredictionResult").value;
    t.sell.stopRuleKept=document.getElementById("editStopRuleKept").value;
    t.sell.sellRuleKept=document.getElementById("editSellRuleKept").value;
    t.sell.reflection=document.getElementById("editReflection").value.trim();
  }

  saveTrades(trades);
  editDialog.close();
  renderTrades();
});

["searchText","statusFilter","categoryFilter","confidenceFilter"].forEach(id=>{
  document.getElementById(id).addEventListener("input",renderTrades);
  document.getElementById(id).addEventListener("change",renderTrades);
});

resetFilters.addEventListener("click",()=>{
  searchText.value="";
  statusFilter.value="all";
  categoryFilter.value="all";
  confidenceFilter.value="all";
  renderTrades();
});

document.getElementById("closeDialog").addEventListener("click",()=>sellDialog.close());
document.getElementById("cancelSell").addEventListener("click",()=>sellDialog.close());
document.getElementById("closeEditDialog").addEventListener("click",()=>editDialog.close());
document.getElementById("cancelEdit").addEventListener("click",()=>editDialog.close());

clearAllButton.addEventListener("click",()=>{
  if(!confirm("すべての記録を削除しますか？")) return;
  localStorage.removeItem(STORAGE_KEY);
  renderTrades();
});

function csvEscape(v){
  const s=String(v??"");
  return /[",\n\r]/.test(s)?`"${s.replaceAll('"','""')}"`:s;
}

document.getElementById("exportCsv").addEventListener("click",()=>{
  const trades=loadTrades();
  if(!trades.length){alert("書き出すデータがありません。");return;}
  const headers=["id","銘柄名","買付日","買値","株数","買った理由","理由カテゴリー","自信度","損切り条件","売却条件","記録日時","売却日","売値","売った理由","予想評価","損切りルール遵守","売却ルール遵守","反省・学び"];
  const rows=trades.map(t=>[t.id,t.symbol,t.buyDate,t.buyPrice,t.shares,t.reason,t.category,t.confidence,t.stopLoss,t.sellRule,t.createdAt,t.sell?.date||"",t.sell?.price||"",t.sell?.reason||"",t.sell?.predictionResult||"",t.sell?.stopRuleKept||"",t.sell?.sellRuleKept||"",t.sell?.reflection||""]);
  const csv="\ufeff"+[headers,...rows].map(r=>r.map(csvEscape).join(",")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=`tradelog_backup_${todayString()}.csv`;a.click();
  URL.revokeObjectURL(url);
});

function parseCsv(text){
  const rows=[]; let row=[],cell="",inQuotes=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i],next=text[i+1];
    if(ch==='"'&&inQuotes&&next==='"'){cell+='"';i++;}
    else if(ch==='"')inQuotes=!inQuotes;
    else if(ch===","&&!inQuotes){row.push(cell);cell="";}
    else if((ch==="\n"||ch==="\r")&&!inQuotes){
      if(ch==="\r"&&next==="\n")i++;
      row.push(cell); if(row.some(v=>v!==""))rows.push(row);
      row=[];cell="";
    } else cell+=ch;
  }
  if(cell.length||row.length){row.push(cell);if(row.some(v=>v!==""))rows.push(row);}
  return rows;
}

document.getElementById("importCsv").addEventListener("change",async e=>{
  const file=e.target.files?.[0]; if(!file)return;
  try{
    const rows=parseCsv((await file.text()).replace(/^\ufeff/,""));
    if(rows.length<2)throw new Error("CSVにデータがありません。");
    const h=rows[0],idx=Object.fromEntries(h.map((x,i)=>[x,i]));
    if(idx["銘柄名"]===undefined)throw new Error("TradeLogのCSV形式ではありません。");
    const trades=rows.slice(1).map(r=>{
      const hasSell=(r[idx["売却日"]]||"")||(r[idx["売値"]]||"");
      return {
        id:r[idx["id"]]||crypto.randomUUID(),
        symbol:r[idx["銘柄名"]]||"",
        buyDate:r[idx["買付日"]]||"",
        buyPrice:r[idx["買値"]]||"",
        shares:r[idx["株数"]]||"",
        reason:r[idx["買った理由"]]||"",
        category:r[idx["理由カテゴリー"]]||"その他",
        confidence:r[idx["自信度"]]||"3",
        stopLoss:r[idx["損切り条件"]]||"",
        sellRule:r[idx["売却条件"]]||"",
        createdAt:r[idx["記録日時"]]||new Date().toLocaleString("ja-JP"),
        sell:hasSell?{
          date:r[idx["売却日"]]||"",
          price:r[idx["売値"]]||"",
          reason:r[idx["売った理由"]]||"",
          predictionResult:r[idx["予想評価"]]||"",
          stopRuleKept:r[idx["損切りルール遵守"]]||"",
          sellRuleKept:r[idx["売却ルール遵守"]]||"",
          reflection:r[idx["反省・学び"]]||""
        }:null
      };
    });
    if(confirm(`${trades.length}件を読み込みます。現在のデータは置き換えられます。続けますか？`)){
      saveTrades(trades);renderTrades();alert("CSVから復元しました。");
    }
  }catch(err){alert(err.message||"読み込みに失敗しました。");}
  e.target.value="";
});

window.addEventListener("resize",renderTrades);


const startLoggingButton = document.getElementById("startLogging");
const showDemoButton = document.getElementById("showDemo");
const emptyStartButton = document.getElementById("emptyStartButton");

function scrollToLogging() {
  document.getElementById("loggingSection")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
  setTimeout(() => document.getElementById("symbol")?.focus(), 450);
}

startLoggingButton?.addEventListener("click", scrollToLogging);
emptyStartButton?.addEventListener("click", scrollToLogging);
showDemoButton?.addEventListener("click", () => {
  document.getElementById("demoSection")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
});

renderTrades();
