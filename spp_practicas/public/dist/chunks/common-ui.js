import{r as d,j as e,a as Q}from"./vendor-react.js";import{b as be,s as ge,u as xe,R as ye,a as ve,r as ne,g as J,l as we,E as ke,h as je,t as Ne,e as Me,c as De}from"./core-shared.js";function P(a){return String(a).padStart(2,"0")}const Se=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"],Ee=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"],Ae=["DO","LU","MA","MI","JU","VI","SA"],Pe=["01","02","03","04","05","06","07","08","09","10","11","12"],$e=Array.from({length:60},(a,n)=>P(n)),Ce=["a. m.","p. m."];function Re(a,n){let o=parseInt(a,10);const r=n==="p. m."||n==="PM";return r&&o<12&&(o+=12),!r&&o===12&&(o=0),P(o)}function K(a){const n=parseInt(a,10),o=n>=12;let r=n%12;return r===0&&(r=12),{h12:P(r),period:o?"p. m.":"a. m."}}function Ie(a,n){if(!a)return"";try{if(n){const m=a.replace("Z","").replace(" ","T"),[p,u]=m.split("T");if(!p)return a;const[E,v,c]=p.split("-");if(!u)return`${P(c)}/${P(v)}/${E}`;const[h,l]=u.split(":"),{h12:f,period:w}=K(h);return`${P(c)}/${P(v)}/${E} ${f}:${P(l||0)} ${w}`}const[o,r,b]=String(a).split("T")[0].split("-");return o&&r&&b?`${P(b)}/${P(r)}/${o}`:a}catch{return a}}function G(a){if(!a)return null;try{const o=String(a).replace(" ","T").split("T"),[r,b,m]=o[0].split("-").map(Number);if(!r||!b||!m)return null;let p=0,u=0;if(o[1]){const E=o[1].split(":").map(Number);p=E[0]||0,u=E[1]||0}return new Date(r,b-1,m,p,u)}catch{return null}}function He({id:a,name:n,value:o="",onChange:r,type:b="datetime-local",required:m=!1,disabled:p=!1,placeholder:u,className:E="",style:v={}}){const c=b==="datetime-local",[h,l]=d.useState(!1),[f,w]=d.useState(!1),x=G(o)||new Date,[g,y]=d.useState(x.getFullYear()),[D,$]=d.useState(x.getMonth()),[I,L]=d.useState(()=>G(o)),B=K(x.getHours()),[U,z]=d.useState(B.h12),[i,M]=d.useState(P(x.getMinutes())),[k,N]=d.useState(B.period),R=d.useRef(null),T=d.useRef(null),q=d.useRef(null),A=d.useRef(null),[C,_]=d.useState({top:null,bottom:null,left:0}),W=d.useCallback(()=>{if(!R.current)return;const t=R.current.getBoundingClientRect();if(t.width===0&&t.height===0)return;const s=c?405:345,j=c?440:290,S=window.innerHeight-t.bottom,Y=t.top;let V=!1;S<s&&Y>S&&(V=!0);let O=t.left;O+j>window.innerWidth-12&&(O=Math.max(12,window.innerWidth-j-12)),O<12&&(O=12),_(V?{top:null,bottom:Math.max(12,Math.round(window.innerHeight-t.top+6)),left:Math.round(O)}:{top:Math.round(t.bottom+6),bottom:null,left:Math.round(O)})},[c]);d.useEffect(()=>{const t=G(o);if(t){L(t),y(t.getFullYear()),$(t.getMonth());const s=K(t.getHours());z(s.h12),M(P(t.getMinutes())),N(s.period)}else L(null)},[o]),d.useEffect(()=>{if(!h)return;W();const t=()=>{W()},s=()=>{W()};return window.addEventListener("scroll",t,{capture:!0,passive:!0}),window.addEventListener("resize",s),()=>{window.removeEventListener("scroll",t,{capture:!0}),window.removeEventListener("resize",s)}},[h,W]),d.useEffect(()=>{if(!h)return;const t=j=>{const S=R.current&&R.current.contains(j.target),Y=T.current&&T.current.contains(j.target);!S&&!Y&&(l(!1),w(!1))},s=j=>{j.key==="Escape"&&(f?w(!1):l(!1))};return document.addEventListener("mousedown",t),document.addEventListener("keydown",s),()=>{document.removeEventListener("mousedown",t),document.removeEventListener("keydown",s)}},[h]),d.useEffect(()=>{h&&c&&setTimeout(()=>{var j,S;const t=(j=q.current)==null?void 0:j.querySelector(".cdp-time-item.is-selected");t&&t.scrollIntoView({block:"nearest"});const s=(S=A.current)==null?void 0:S.querySelector(".cdp-time-item.is-selected");s&&s.scrollIntoView({block:"nearest"})},30)},[h,c]);const re=t=>{if(t.preventDefault(),t.stopPropagation(),f){y(s=>s-1);return}D===0?($(11),y(s=>s-1)):$(s=>s-1)},ie=t=>{if(t.preventDefault(),t.stopPropagation(),f){y(s=>s+1);return}D===11?($(0),y(s=>s+1)):$(s=>s+1)},ce=(t,s,j)=>{const S=new Date(t,s,j);L(S)},X=t=>{t.preventDefault(),t.stopPropagation(),L(null),r&&r({target:{value:"",name:n,id:a}}),w(!1),l(!1)},ee=t=>{t.preventDefault(),t.stopPropagation();const s=new Date;if(L(s),y(s.getFullYear()),$(s.getMonth()),c){const j=K(s.getHours());z(j.h12),M(P(s.getMinutes())),N(j.period)}},te=t=>{t.preventDefault(),t.stopPropagation();const s=I||new Date,j=s.getFullYear(),S=P(s.getMonth()+1),Y=P(s.getDate());let V=`${j}-${S}-${Y}`;if(c){const O=Re(U,k);V+=`T${O}:${i}`}r&&r({target:{value:V,name:n,id:a}}),w(!1),l(!1)},le=new Date(g,D+1,0).getDate(),de=new Date(g,D,1).getDay(),pe=new Date(g,D,0).getDate(),F=[];for(let t=de-1;t>=0;t--){const s=pe-t,j=D===0?11:D-1,S=D===0?g-1:g;F.push({day:s,month:j,year:S,isCurrentMonth:!1})}for(let t=1;t<=le;t++)F.push({day:t,month:D,year:g,isCurrentMonth:!0});const ue=Math.ceil(F.length/7)*7;let fe=1;for(;F.length<ue;){const t=D===11?0:D+1,s=D===11?g+1:g;F.push({day:fe++,month:t,year:s,isCurrentMonth:!1})}const Z=new Date,me=t=>t.year===Z.getFullYear()&&t.month===Z.getMonth()&&t.day===Z.getDate(),he=t=>I&&t.year===I.getFullYear()&&t.month===I.getMonth()&&t.day===I.getDate(),ae=Ie(o,c);return e.jsxs("div",{ref:R,className:`cdp-wrap ${p?"is-disabled":""} ${E}`,style:{position:"relative",width:"100%",...v},children:[e.jsxs("div",{className:`cdp-input-box ${h?"is-open":""}`,tabIndex:p?-1:0,role:"button","aria-haspopup":"dialog","aria-expanded":h,onClick:()=>{p||l(t=>!t)},onKeyDown:t=>{p||(t.key==="Enter"||t.key===" ")&&(t.preventDefault(),l(s=>!s))},children:[e.jsx("span",{className:`cdp-value-text ${ae?"":"is-placeholder"}`,children:ae||u||(c?"dd/mm/aaaa --:--":"dd/mm/aaaa")}),e.jsx("i",{className:"fa-regular fa-calendar right-icon cdp-icon","aria-hidden":"true"})]}),e.jsx("input",{type:"hidden",id:a,name:n,value:o,required:m,disabled:p}),h&&typeof document<"u"&&Q.createPortal(e.jsxs("div",{ref:T,className:"cdp-popup",role:"dialog","aria-modal":"true",style:{position:"fixed",top:C.top!==null?`${C.top}px`:"auto",bottom:C.bottom!==null?`${C.bottom}px`:"auto",left:`${C.left}px`,zIndex:9999999},onClick:t=>t.stopPropagation(),onMouseDown:t=>t.stopPropagation(),children:[e.jsxs("div",{className:"cdp-body",children:[e.jsxs("div",{className:"cdp-calendar",children:[e.jsxs("div",{className:"cdp-header",children:[e.jsxs("button",{type:"button",className:"cdp-month-selector-btn",onClick:t=>{t.preventDefault(),t.stopPropagation(),w(s=>!s)},title:"Seleccionar mes o año",children:[e.jsxs("span",{className:"cdp-month-label",children:[Se[D]," de ",g]}),e.jsx("i",{className:`fa-solid ${f?"fa-chevron-up":"fa-chevron-down"} cdp-caret`})]}),e.jsxs("div",{className:"cdp-nav-arrows",children:[e.jsx("button",{type:"button",className:"cdp-arrow-btn","aria-label":"Mes anterior",title:"Mes anterior",onClick:re,children:e.jsx("i",{className:"fa-solid fa-chevron-left"})}),e.jsx("button",{type:"button",className:"cdp-arrow-btn","aria-label":"Mes siguiente",title:"Mes siguiente",onClick:ie,children:e.jsx("i",{className:"fa-solid fa-chevron-right"})})]})]}),f?e.jsxs("div",{className:"cdp-month-picker-view",children:[e.jsxs("div",{className:"cdp-year-bar",children:[e.jsx("button",{type:"button",className:"cdp-arrow-btn","aria-label":"Año anterior",onClick:t=>{t.preventDefault(),t.stopPropagation(),y(s=>s-1)},children:e.jsx("i",{className:"fa-solid fa-chevron-left"})}),e.jsx("span",{className:"cdp-year-display",children:g}),e.jsx("button",{type:"button",className:"cdp-arrow-btn","aria-label":"Año siguiente",onClick:t=>{t.preventDefault(),t.stopPropagation(),y(s=>s+1)},children:e.jsx("i",{className:"fa-solid fa-chevron-right"})})]}),e.jsx("div",{className:"cdp-month-grid",children:Ee.map((t,s)=>{const j=s===D;return e.jsx("button",{type:"button",className:`cdp-month-chip${j?" is-selected":""}`,onClick:S=>{S.preventDefault(),S.stopPropagation(),$(s),w(!1)},children:t},t)})})]}):e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"cdp-weekdays",children:Ae.map(t=>e.jsx("span",{className:"cdp-weekday",children:t},t))}),e.jsx("div",{className:"cdp-days",children:F.map((t,s)=>{const j=he(t),S=me(t);return e.jsx("button",{type:"button",className:`cdp-day-btn${t.isCurrentMonth?"":" is-outside"}${j?" is-selected":""}${S?" is-today":""}`,onClick:()=>ce(t.year,t.month,t.day),children:t.day},s)})})]}),!c&&e.jsxs("div",{className:"cdp-footer",children:[e.jsx("button",{type:"button",className:"cdp-btn-clear",onClick:X,children:"Borrar"}),e.jsxs("div",{className:"cdp-footer-right",children:[e.jsx("button",{type:"button",className:"cdp-btn-today",onClick:ee,children:"Hoy"}),e.jsx("button",{type:"button",className:"cdp-btn-accept",onClick:te,children:"Aceptar"})]})]})]}),c&&e.jsx("div",{className:"cdp-time-pane",children:e.jsxs("div",{className:"cdp-time-columns",children:[e.jsx("div",{ref:q,className:"cdp-time-col",children:Pe.map(t=>e.jsx("button",{type:"button",className:`cdp-time-item${U===t?" is-selected":""}`,onClick:()=>z(t),children:t},t))}),e.jsx("div",{ref:A,className:"cdp-time-col",children:$e.map(t=>e.jsx("button",{type:"button",className:`cdp-time-item${i===t?" is-selected":""}`,onClick:()=>M(t),children:t},t))}),e.jsx("div",{className:"cdp-time-col cdp-period-col",children:Ce.map(t=>e.jsx("button",{type:"button",className:`cdp-time-item${k===t?" is-selected":""}`,onClick:()=>N(t),children:t},t))})]})})]}),c&&e.jsxs("div",{className:"cdp-footer",children:[e.jsx("button",{type:"button",className:"cdp-btn-clear",onClick:X,children:"Borrar"}),e.jsxs("div",{className:"cdp-footer-right",children:[e.jsx("button",{type:"button",className:"cdp-btn-today",onClick:ee,children:"Hoy"}),e.jsx("button",{type:"button",className:"cdp-btn-accept",onClick:te,children:"Aceptar"})]})]})]}),document.body),e.jsx("style",{children:`
                .cdp-wrap {
                    position: relative;
                    font-family: inherit;
                    user-select: none;
                }
                .cdp-input-box {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    width: 100%;
                    height: 48px;
                    padding: 0 16px;
                    border-radius: 12px;
                    border: 1px solid rgba(0, 0, 0, 0.12);
                    background: #f7faf8;
                    color: #103323;
                    font-size: 14.5px;
                    cursor: pointer;
                    transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
                    box-sizing: border-box;
                }
                .cdp-input-box:hover {
                    border-color: #288360;
                    background: #ffffff;
                }
                .cdp-input-box.is-open {
                    border-color: #1f7a63;
                    background: #ffffff;
                    box-shadow: 0 0 0 3px rgba(31, 122, 99, 0.15);
                }
                .cdp-value-text {
                    font-weight: 500;
                    color: #103323;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .cdp-value-text.is-placeholder {
                    color: #8fa097;
                    font-weight: 400;
                }
                .cdp-icon {
                    color: #53685e;
                    font-size: 16px;
                    flex-shrink: 0;
                    margin-left: 8px;
                }
                .cdp-wrap.is-disabled .cdp-input-box {
                    opacity: 0.6;
                    cursor: not-allowed;
                    background: #f0f0f0;
                }
                .cdp-popup {
                    position: fixed;
                    z-index: 9999999;
                    background: #ffffff;
                    border-radius: 18px;
                    border: 1px solid rgba(0, 0, 0, 0.08);
                    box-shadow: 0 16px 45px rgba(0, 0, 0, 0.22), 0 4px 14px rgba(0, 0, 0, 0.08);
                    padding: 14px 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    animation: cdpFadeIn .18s ease-out;
                    box-sizing: border-box;
                }
                @media (max-width: 480px) {
                    .cdp-popup {
                        left: 8px !important;
                        right: 8px !important;
                        max-width: calc(100vw - 16px) !important;
                        overflow-x: auto;
                    }
                    .cdp-body {
                        flex-direction: column;
                    }
                    .cdp-calendar {
                        width: 100% !important;
                    }
                    .cdp-time-pane {
                        border-left: none !important;
                        border-top: 1px solid rgba(0, 0, 0, 0.08);
                        padding-left: 0 !important;
                        padding-top: 8px;
                    }
                }
                @keyframes cdpFadeIn {
                    from { opacity: 0; transform: translateY(-6px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .cdp-body {
                    display: flex;
                    gap: 16px;
                }
                .cdp-calendar {
                    width: 252px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .cdp-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 2px 4px 6px;
                    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
                }
                .cdp-month-selector-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    border: none;
                    background: transparent;
                    padding: 4px 8px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background .15s ease;
                }
                .cdp-month-selector-btn:hover {
                    background: #e6f0eb;
                }
                .cdp-caret {
                    font-size: 11px;
                    color: #4b6357;
                    transition: transform .2s ease;
                }
                .cdp-month-picker-view {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding: 6px 0;
                    min-height: 220px;
                    justify-content: center;
                }
                .cdp-year-bar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 8px;
                }
                .cdp-year-display {
                    font-size: 15px;
                    font-weight: 700;
                    color: #103323;
                }
                .cdp-month-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                    padding: 4px;
                }
                .cdp-month-chip {
                    padding: 9px 4px;
                    border: none;
                    border-radius: 9px;
                    background: #f5f8f6;
                    color: #103323;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all .15s ease;
                }
                .cdp-month-chip:hover {
                    background: #e0ece5;
                    color: #103323;
                }
                .cdp-month-chip.is-selected {
                    background: #1f7a63 !important;
                    color: #ffffff !important;
                    box-shadow: 0 2px 6px rgba(31, 122, 99, 0.35);
                }
                .cdp-month-label {
                    font-size: 14.5px;
                    font-weight: 700;
                    color: #103323;
                    text-transform: capitalize;
                }
                .cdp-nav-arrows {
                    display: flex;
                    gap: 4px;
                }
                .cdp-arrow-btn {
                    display: grid;
                    place-items: center;
                    width: 28px;
                    height: 28px;
                    border: none;
                    background: transparent;
                    color: #4b6357;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: background .12s ease, color .12s ease;
                }
                .cdp-arrow-btn:hover {
                    background: #e6f0eb;
                    color: #103323;
                }
                .cdp-weekdays {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    text-align: center;
                    font-size: 11.5px;
                    font-weight: 700;
                    color: #72867c;
                    margin-bottom: 2px;
                }
                .cdp-weekday {
                    padding: 4px 0;
                }
                .cdp-days {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 3px;
                }
                .cdp-day-btn {
                    display: grid;
                    place-items: center;
                    height: 32px;
                    border: none;
                    background: transparent;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 500;
                    color: #103323;
                    cursor: pointer;
                    transition: background .12s ease, color .12s ease;
                    outline: none;
                }
                .cdp-day-btn:hover {
                    background: #e3efe5;
                }
                .cdp-day-btn.is-outside {
                    color: #b5c4bd;
                }
                .cdp-day-btn.is-today {
                    border: 1px solid #1f7a63;
                    font-weight: 700;
                }
                .cdp-day-btn.is-selected {
                    background: #1f7a63 !important;
                    color: #ffffff !important;
                    font-weight: 700;
                    box-shadow: 0 2px 8px rgba(31, 122, 99, 0.35);
                }
                .cdp-time-pane {
                    border-left: 1px solid rgba(0, 0, 0, 0.08);
                    padding-left: 14px;
                }
                .cdp-time-columns {
                    display: flex;
                    gap: 6px;
                    height: 228px;
                }
                .cdp-time-col {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    width: 52px;
                    overflow-y: auto;
                    max-height: 228px;
                    padding-right: 2px;
                    scrollbar-width: thin;
                }
                .cdp-period-col {
                    width: 58px;
                }
                .cdp-time-col::-webkit-scrollbar {
                    width: 4px;
                }
                .cdp-time-col::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.15);
                    border-radius: 4px;
                }
                .cdp-time-item {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 30px;
                    min-height: 30px;
                    border: none;
                    background: #f5f8f6;
                    color: #103323;
                    border-radius: 7px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background .12s ease, color .12s ease;
                    flex-shrink: 0;
                }
                .cdp-time-item:hover {
                    background: #e0ece5;
                }
                .cdp-time-item.is-selected {
                    background: #1f7a63 !important;
                    color: #ffffff !important;
                    box-shadow: 0 2px 6px rgba(31, 122, 99, 0.35);
                }
                .cdp-footer {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding-top: 8px;
                    border-top: 1px solid rgba(0, 0, 0, 0.07);
                    margin-top: 2px;
                }
                .cdp-btn-clear {
                    border: none;
                    background: transparent;
                    color: #b3261e;
                    font-size: 13px;
                    font-weight: 700;
                    cursor: pointer;
                    padding: 6px 8px;
                    border-radius: 6px;
                    transition: background .12s ease;
                }
                .cdp-btn-clear:hover {
                    background: #fee2e2;
                }
                .cdp-footer-right {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .cdp-btn-today {
                    border: none;
                    background: transparent;
                    color: #1f7a63;
                    font-size: 13px;
                    font-weight: 700;
                    cursor: pointer;
                    padding: 6px 10px;
                    border-radius: 6px;
                    transition: background .12s ease;
                }
                .cdp-btn-today:hover {
                    background: #e3efe5;
                }
                .cdp-btn-accept {
                    border: none;
                    background: #1f7a63;
                    color: #ffffff;
                    font-size: 13px;
                    font-weight: 700;
                    cursor: pointer;
                    padding: 6px 14px;
                    border-radius: 8px;
                    box-shadow: 0 2px 6px rgba(31, 122, 99, 0.3);
                    transition: background .15s ease, transform .12s ease;
                }
                .cdp-btn-accept:hover {
                    background: #176350;
                    transform: translateY(-1px);
                }
                .cdp-btn-accept:active {
                    transform: translateY(0);
                }

                /* Dark mode support */
                body.dark-theme .cdp-input-box {
                    background: #163628;
                    color: #ffffff;
                    border-color: rgba(255, 255, 255, 0.12);
                }
                body.dark-theme .cdp-value-text {
                    color: #ffffff;
                }
                body.dark-theme .cdp-value-text.is-placeholder {
                    color: #8da398;
                }
                body.dark-theme .cdp-icon {
                    color: #a8c7b9;
                }
                body.dark-theme .cdp-popup {
                    background: #143527;
                    border-color: rgba(255, 255, 255, 0.12);
                    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
                }
                body.dark-theme .cdp-month-label {
                    color: #ffffff;
                }
                body.dark-theme .cdp-month-selector-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
                body.dark-theme .cdp-caret {
                    color: #a8c7b9;
                }
                body.dark-theme .cdp-year-display {
                    color: #ffffff;
                }
                body.dark-theme .cdp-month-chip {
                    background: rgba(255, 255, 255, 0.08);
                    color: #ffffff;
                }
                body.dark-theme .cdp-month-chip:hover {
                    background: rgba(255, 255, 255, 0.16);
                }
                body.dark-theme .cdp-month-chip.is-selected {
                    background: #1f7a63 !important;
                    color: #ffffff !important;
                }
                body.dark-theme .cdp-arrow-btn {
                    color: #a8c7b9;
                }
                body.dark-theme .cdp-arrow-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: #ffffff;
                }
                body.dark-theme .cdp-day-btn {
                    color: #ffffff;
                }
                body.dark-theme .cdp-day-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
                body.dark-theme .cdp-time-item {
                    background: rgba(255, 255, 255, 0.08);
                    color: #ffffff;
                }
                body.dark-theme .cdp-time-item:hover {
                    background: rgba(255, 255, 255, 0.16);
                }
            `})]})}const Le=6e4;function oe(a){const n=new Date(a);if(isNaN(n.getTime()))return"";const o=Math.max(0,Math.round((Date.now()-n.getTime())/6e4));return o<1?"ahora":o<60?"hace "+o+" min":o<1440?"hace "+Math.round(o/60)+" h":o<10080?"hace "+Math.round(o/1440)+" d":n.toLocaleDateString("es-CO",{day:"2-digit",month:"short",year:"numeric"})}function Te(a){const n=(a.subject||"").toLowerCase();return n.includes("práctica")||n.includes("practica")||n.includes("actividad")||n.includes("evaluación")||n.includes("evaluacion")?"fa-solid fa-book-open":n.includes("aprobada")||n.includes("registro")||n.includes("cuenta")?"fa-solid fa-user-check":n.includes("retroalimentación")||n.includes("retroalimentacion")||n.includes("comentario")?"fa-solid fa-comments":"fa-solid fa-book-open"}function Oe(a,n){const o=String(a||"").trim(),r=String(n||"").trim();if(!r)return{intro:"",cards:[],rest:""};const b=r.split(/\r?\n/).map(c=>c.trim()).filter(Boolean),m=[];let p,u="";if(b.filter(c=>/^[•\-*]/.test(c)).length>0){const c=[],h=[];let l=!1;for(const f of b)if(/^[•\-*]/.test(f)){l=!0;const w=f.replace(/^[•\-*]\s*/,"").trim(),x=w.indexOf("—"),g=w.indexOf(" - "),y=x!==-1?x:g;if(y!==-1){const D=w.slice(0,y).trim(),$=w.slice(y+(x!==-1?1:3)).trim();m.push({title:D,meta:$})}else m.push({title:w,meta:""})}else l?h.push(f):c.push(f);return p=c.join(" "),u=h.join(" "),{intro:p,cards:m,rest:u}}const v=r.match(/«([^»]+)»/);if(v||/retroalimentaci[oó]n|comentario/i.test(o)||/retroalimentaci[oó]n|comentario/i.test(r)){const c=v?`«${v[1]}»`:"";let h="";const l=[];for(const y of b)/^hola\s+/i.test(y)?h=y:/ingresa al spp/i.test(y)?u=y:y.includes("«")||l.push(y);p=[h,l.join(" ")].filter(Boolean).join(" ");let f="";const w=o.match(/(?:en tu actividad|actividad):\s*([^,.]+)/i);w&&(f=w[1].trim());let x="";const g=r.match(/([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*\s*\([^)]+\))\s+dejó/);return g&&(x=g[1].trim()),m.push({title:f?`Actividad: ${f}`:"Retroalimentación recibida",meta:[c,x?`Por: ${x}`:""].filter(Boolean).join(" · ")||c||"Nueva retroalimentación registrada"}),{intro:p,cards:m,rest:u||"Ingresa al SPP para ver el detalle completo."}}if(/calificad[ao]|nota/i.test(o)||/nota obtenida|nota final/i.test(r)){let c="",h="",l="";const f=[];for(const g of b)/^hola\s+/i.test(g)?c=g:/nota\s+(?:obtenida|final):\s*([0-9.,]+(?:\s+de\s+[0-9.,]+)?)/i.test(g)?h=g:/observaci[oó]n/i.test(g)?l=g:/ingresa al spp/i.test(g)?u=g:f.push(g);p=[c,f.join(" ")].filter(Boolean).join(" ");const w=o.match(/(?:calificad[ao]:|evaluación:)\s*(.+)/i),x=w?w[1].trim():"";return m.push({title:h||"Calificación registrada",meta:[x,l].filter(Boolean).join(" · ")||"Detalle disponible en la plataforma"}),{intro:p,cards:m,rest:u}}if(/asignad[ao]/i.test(o)||/se te asignó/i.test(r)){let c="",h="";const l=[];for(const x of b)/^hola\s+/i.test(x)?c=x:/vigencia:/i.test(x)?h=x:l.push(x);p=[c,l.join(" ")].filter(Boolean).join(" ");const f=o.match(/asignado una práctica:\s*(.+)/i)||r.match(/la práctica "([^"]+)"/i),w=f?f[1].trim():"Práctica Pedagógica";return m.push({title:`Práctica: ${w}`,meta:h||"Asignación confirmada en el sistema"}),{intro:p,cards:m,rest:u}}if(/disponible|vence|recordatorio/i.test(o)||/fecha límite/i.test(r)){let c="",h="";const l=[];for(const f of b)/^hola\s+/i.test(f)?c=f:/fecha límite:|vence el/i.test(f)?h=f:/entra al spp|ingresa al spp/i.test(f)?u=f:l.push(f);return p=[c,l.join(" ")].filter(Boolean).join(" "),m.push({title:o.replace(/^Recordatorio:\s*/i,"").trim(),meta:h||"Revisa la fecha límite en el sistema"}),{intro:p,cards:m,rest:u}}if(/registro|aprobada|cuenta/i.test(o)){let c="";const h=[];for(const l of b)/^hola\s+/i.test(l)?c=l:/ya puedes ingresar/i.test(l)?u=l:h.push(l);return p=[c,h.join(" ")].filter(Boolean).join(" "),m.push({title:o,meta:"Software de Prácticas Pedagógicas (SPP)"}),{intro:p,cards:m,rest:u}}return b.length>1?(p=b[0],m.push({title:b[1],meta:b.slice(2).join(" ")})):p=b[0]||"",{intro:p,cards:m,rest:u}}function se({n:a,isExpanded:n,onToggle:o,onMarkRead:r}){const{intro:b,cards:m,rest:p}=Oe(a.subject,a.content);return e.jsxs("div",{className:`bell-item${a.read?" is-read":" is-unread"}${n?" is-expanded":""}`,onClick:u=>{u.stopPropagation(),o(),a.read||r(a.id)},role:"button",tabIndex:0,"aria-expanded":n,onKeyDown:u=>{(u.key==="Enter"||u.key===" ")&&(u.preventDefault(),o(),a.read||r(a.id))},children:[e.jsx("div",{className:"bell-item-icon","aria-hidden":"true",children:e.jsx("i",{className:Te(a)})}),e.jsxs("div",{className:"bell-item-content",children:[e.jsxs("div",{className:"bell-item-top",children:[e.jsx("h4",{className:"bell-item-subject",children:a.subject}),e.jsxs("div",{className:"bell-item-indicators",children:[a.read?null:e.jsx("span",{className:"bell-unread-dot","aria-label":"No leída"}),e.jsx("i",{className:`fa-solid fa-chevron-down bell-chevron${n?" is-open":""}`,"aria-hidden":"true"})]})]}),n?e.jsxs("div",{className:"bell-item-body",children:[b?e.jsx("p",{className:"bell-item-desc",children:b}):null,m.length>0?e.jsx("div",{className:"bell-item-cards",children:m.map((u,E)=>e.jsxs("div",{className:"bell-card-inner",children:[e.jsx("strong",{className:"bell-card-inner-title",children:u.title}),u.meta?e.jsx("p",{className:"bell-card-inner-meta",children:u.meta}):null]},E))}):null,p?e.jsx("p",{className:"bell-item-desc bell-item-rest",children:p}):null,e.jsxs("div",{className:"bell-item-meta",children:[e.jsx("i",{className:"fa-regular fa-clock","aria-hidden":"true"}),e.jsx("span",{children:oe(a.createdAt)})]})]}):e.jsxs("div",{className:"bell-item-meta bell-item-meta-collapsed",children:[e.jsx("i",{className:"fa-regular fa-clock","aria-hidden":"true"}),e.jsx("span",{children:oe(a.createdAt)})]})]})]})}function _e(){const[a,n]=d.useState([]),[o,r]=d.useState(0),[b,m]=d.useState(!1),[p,u]=d.useState(()=>new Set),E=d.useCallback(i=>{u(M=>{const k=new Set(M);return k.has(i)?k.delete(i):k.add(i),k})},[]),[v,c]=d.useState(!1),[h,l]=d.useState({width:"400px",top:"0px",left:"0px"}),f=d.useRef(null),w=d.useRef(null),x=d.useRef(!1);x.current=b,d.useEffect(()=>{const M=be(N=>{N.preventDefault(),we()});let k=!1;return(async()=>{try{const N=await ge();if(k||!N)return;xe(N,ye)}catch{}})(),()=>{k=!0,M()}},[]),d.useEffect(()=>{ve(o)},[o]);const g=d.useCallback(i=>{const M=i||f.current;if(!M)return;const k=M.getBoundingClientRect(),N=Math.min(410,window.innerWidth-24),R=Math.round(k.bottom+8),T=Math.max(12,Math.min(window.innerWidth-N-12,Math.round(k.right-N)));l({width:`${N}px`,top:`${R}px`,left:`${T}px`})},[]),y=d.useCallback(async()=>{try{const i=await ne("/api/notifications",{skipRedirect:!0}),M=Array.isArray(i&&i.notifications)?i.notifications:[];n(M),r(Number(i&&i.unread)||0)}catch{}},[]),D=d.useCallback(async i=>{try{await ne("/api/notifications/read",{method:"POST",body:i?{id:i}:{},skipRedirect:!0}),n(M=>{const k=M.map(N=>!i||N.id===i?{...N,read:!0}:N);return r(k.filter(N=>!N.read).length),k})}catch{}},[]);if(d.useEffect(()=>{const i=J();if(!i.length)return;const M=(A,C)=>{i.forEach(_=>_.setAttribute("aria-expanded",C&&_===A?"true":"false"))},k=A=>{A.stopPropagation();const C=A.currentTarget;if(x.current&&f.current===C){m(!1),M(null,!1);return}f.current=C,g(C),m(!0),M(C,!0),y()};i.forEach(A=>{A.setAttribute("aria-haspopup","dialog"),A.setAttribute("aria-expanded","false"),A.addEventListener("click",k)});const N=A=>{A.key==="Escape"&&x.current&&(m(!1),M(null,!1))},R=()=>{x.current&&g()},T=()=>{document.hidden||y()};document.addEventListener("keydown",N),window.addEventListener("resize",R),document.addEventListener("visibilitychange",T),y();const q=setInterval(()=>{document.hidden||y()},Le);return()=>{clearInterval(q),i.forEach(A=>A.removeEventListener("click",k)),document.removeEventListener("keydown",N),window.removeEventListener("resize",R),document.removeEventListener("visibilitychange",T)}},[y,g]),typeof document>"u")return null;const $=a.filter(i=>!i.read),I=a.filter(i=>i.read),L=5,B=v?$:$.slice(0,L),U=Math.max(0,L-B.length),z=v?I:I.slice(0,U||3);return Q.createPortal(e.jsxs(e.Fragment,{children:[b?e.jsx("div",{className:"bell-backdrop",onClick:i=>{i.stopPropagation(),m(!1),J().forEach(k=>k.setAttribute("aria-expanded","false"))},"aria-hidden":"true"}):null,e.jsxs("div",{ref:w,className:"bell-panel",onClick:i=>i.stopPropagation(),role:"dialog","aria-label":"Notificaciones",hidden:!b,style:h,children:[e.jsxs("div",{className:"bell-head",children:[e.jsxs("div",{className:"bell-head-left",children:[e.jsx("div",{className:"bell-head-icon","aria-hidden":"true",children:e.jsx("i",{className:"fa-regular fa-bell"})}),e.jsx("h3",{className:"bell-head-title",children:"Notificaciones"}),e.jsxs("span",{className:"bell-unread-pill",children:[o," ",o===1?"nueva":"nuevas"]})]}),e.jsxs("div",{className:"bell-head-right",children:[o>0?e.jsxs("button",{type:"button",className:"bell-markall",onClick:()=>D(null),title:"Marcar todas como leídas",children:[e.jsx("i",{className:"fa-solid fa-check","aria-hidden":"true"})," Marcar todas"]}):null,e.jsx("button",{type:"button",className:"bell-close-btn","aria-label":"Cerrar notificaciones",onClick:i=>{i.stopPropagation(),m(!1),J().forEach(k=>k.setAttribute("aria-expanded","false"))},title:"Cerrar",children:e.jsx("i",{className:"fa-solid fa-xmark","aria-hidden":"true"})})]})]}),e.jsx("div",{className:"bell-list",children:a.length===0?e.jsx("p",{className:"bell-empty",children:"No tienes notificaciones."}):e.jsxs(e.Fragment,{children:[B.length>0?e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"bell-section-title",children:"NUEVAS"}),B.map(i=>e.jsx(se,{n:i,isExpanded:p.has(i.id),onToggle:()=>E(i.id),onMarkRead:D},i.id))]}):null,z.length>0?e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"bell-section-title",children:"ANTERIORES"}),z.map(i=>e.jsx(se,{n:i,isExpanded:p.has(i.id),onToggle:()=>E(i.id),onMarkRead:D},i.id))]}):null]})}),a.length>0?e.jsx("div",{className:"bell-footer",children:e.jsx("button",{type:"button",className:"bell-footer-btn",onClick:()=>c(i=>!i),children:v?"Mostrar menos":"Ver todas las notificaciones"})}):null]})]}),document.body)}const Be={BORRADOR:["Draft","fa-regular fa-pen-to-square"],PUBLICADA:["Published","fa-solid fa-circle-check"],CERRADA:["Closed","fa-solid fa-lock"],EN_CURSO:["In progress","fa-solid fa-hourglass-half"],ENVIADO:["Pending review","fa-regular fa-clock"],CALIFICADO:["Graded","fa-solid fa-circle-check"],APROBADA:["Approved","fa-solid fa-check"],RECHAZADA:["Rejected","fa-solid fa-ban"],VENCIDA:["Deadline passed","fa-regular fa-calendar-xmark"]},Ye={OPCION_MULTIPLE:"Multiple choice",VERDADERO_FALSO:"True / False",ABIERTA:"Open"};function Ve(a){if(!a)return"—";const n=new Date(a);return isNaN(n)?"—":n.toLocaleDateString("en-US",{day:"2-digit",month:"short",year:"numeric"})+" "+n.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}function Ue(a){return a==null?"—":Number(a).toFixed(2)}function qe(a,n,o){return`${a} ${a===1?n:o}`}function We(a,n){Ne(a,n)}function Ke(a){Me(a)}function Ze(a){return De(a)}function Je(){je()}function Ge(){window.scrollTo(0,0);const a=document.querySelector(".app-shell");a&&(a.scrollTop=0);const n=document.querySelector(".ev-wrapper");n&&(n.scrollTop=0)}function Qe(a){if(!a)return"";const n=new Date(a);if(isNaN(n))return"";const o=r=>String(r).padStart(2,"0");return`${n.getFullYear()}-${o(n.getMonth()+1)}-${o(n.getDate())}T${o(n.getHours())}:${o(n.getMinutes())}`}function Xe(){return ke}function H({name:a}){return e.jsx("i",{className:a,"aria-hidden":"true"})}function et({estado:a,textoPropio:n}){if(!a)return null;const[o,r]=Be[a]||[a,"fa-solid fa-circle"];return e.jsxs("span",{className:`ev-badge ev-badge--${String(a).toLowerCase()}`,children:[e.jsx(H,{name:r}),n||o]})}function tt({origen:a}){return a==="IA"?e.jsxs("span",{className:"ev-badge ev-badge--ia",children:[e.jsx(H,{name:"fa-solid fa-wand-magic-sparkles"}),"AI"]}):e.jsxs("span",{className:"ev-badge ev-badge--manual",children:[e.jsx(H,{name:"fa-solid fa-pen"}),"Manual"]})}function at({className:a="",icon:n,busyText:o,onClick:r,disabled:b=!1,title:m,style:p,children:u,...E}){const[v,c]=d.useState(!1),h=async l=>{if(!(v||b||!r)){c(!0),document.body.classList.add("is-loading-wait");try{await r(l)}finally{c(!1),document.body.classList.remove("is-loading-wait")}}};return e.jsx("button",{type:"button",className:`${a}${v?" is-busy":""}`,disabled:b||v,title:m,style:p,onClick:h,...E,children:v&&o?e.jsxs(e.Fragment,{children:[e.jsx(H,{name:"fa-solid fa-spinner fa-spin"})," ",o]}):e.jsxs(e.Fragment,{children:[n?e.jsx(H,{name:n}):null,u]})})}function nt({titulo:a,ancho:n,cerrarAfuera:o=!1,onClose:r,children:b}){const m=d.useRef(null),[p,u]=d.useState(!1);d.useEffect(()=>{const v=document.activeElement,c=l=>{l.key==="Escape"&&(l.stopPropagation(),r==null||r())};document.addEventListener("keydown",c);const h=setTimeout(()=>{var f;const l=(f=m.current)==null?void 0:f.querySelector("input,textarea,select,button:not(.ev-modal-close)");l&&l.focus()},30);return()=>{clearTimeout(h),document.removeEventListener("keydown",c),v&&typeof v.focus=="function"&&v.focus()}},[r]);const E=v=>{v.target===v.currentTarget&&(o?r==null||r():(u(!1),setTimeout(()=>u(!0),10)))};return Q.createPortal(e.jsx("div",{className:"ev-modal-overlay",onMouseDown:E,children:e.jsxs("div",{ref:m,className:`ev-modal${p?" ev-modal--shake":""}`,role:"dialog","aria-modal":"true",style:n?{maxWidth:`${n}px`}:void 0,children:[e.jsx("button",{type:"button",className:"ev-modal-close","aria-label":"Close",onClick:()=>r==null?void 0:r(),children:e.jsx(H,{name:"fa-solid fa-xmark"})}),e.jsx("h3",{className:"ev-modal-title",children:a}),b]})}),document.body)}export{at as B,He as C,H as I,nt as M,_e as P,Ye as T,tt as a,et as b,Ze as c,Qe as d,Ve as f,Xe as g,Je as h,Ke as m,Ue as n,qe as p,Ge as s,We as t};
