import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
// import Sakana from 'sakana';
// import './styles/sakana.css'; // 导入样式

import '../node_modules/sakana-widget/lib/index.css';
import SakanaWidget from 'sakana-widget';


const sakanaContainer = document.createElement('div');
sakanaContainer.className = 'sakana-widget';
sakanaContainer.style.cssText = `
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 200px;
  height: 200px;
  z-index: 1000;
  pointer-events: auto; /* 确保可以交互 */
`;
document.body.appendChild(sakanaContainer);

const CustomizeChar_1 = SakanaWidget.getCharacter('chisato');
CustomizeChar_1.image = '/Kagami Hiiragi_01.gif';
SakanaWidget.registerCharacter('Char1', CustomizeChar_1);
// 初始化并挂载
// new SakanaWidget({ character: 'myGithub' }).mount('#sakana-widget');官方错误写法
const widget_1 = new SakanaWidget({ character: 'Char1' });

const CustomizeChar_2 = SakanaWidget.getCharacter('chisato');
CustomizeChar_2.image = '/das_Konata_68.png';
SakanaWidget.registerCharacter('Char2', CustomizeChar_2);
// 初始化并挂载
// new SakanaWidget({ character: 'myGithub' }).mount('#sakana-widget');官方错误写法
const widget_2 = new SakanaWidget({ character: 'Char2' });


//多角色应用（覆盖），不设时限会出错
widget_1.mount(sakanaContainer);
console.log('挂载widget_1...');

setTimeout(() => {
  console.log('挂载widget_2...');
  widget_2.mount(sakanaContainer); // 这将覆盖widget_1
}, 3000);

// // 先挂载第一个
// console.log('挂载widget_1...');
// widget_1.mount(sakanaContainer);

// // 3秒后挂载第二个，观察是否会覆盖
// setTimeout(() => {
//   console.log('挂载widget_2...');
//   widget_2.mount(sakanaContainer); // 这将覆盖widget_1
// }, 3000);



/* // ========== 在这里添加Sakana初始化代码 ==========
// 创建容器元素
const sakanaContainer = document.createElement('div');
sakanaContainer.className = 'sakana-box';

// 设置样式(无效)
Object.assign(sakanaContainer.style, {
  position: 'fixed',
  top: '10px',
  left: '80px',
  zIndex: '9999',
  pointerEvents: 'auto',
});
// 添加到body
document.body.appendChild(sakanaContainer);

// 初始化Sakana
Sakana.init({
  el: sakanaContainer,
  scale: 0.4,
  y:0,
  setMute:false,
  canSwitchCharacter: true,
});

Sakana.setMute(true);
// ========== Sakana初始化结束 ========== */

// 保持原有的React渲染代码不变
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

