/** Browser regression test. Run a Vite server first.
 * npm install --prefix /tmp/ylist-interface-tools playwright @axe-core/playwright
 * PLAYWRIGHT_MODULE=/tmp/ylist-interface-tools/node_modules/playwright/index.mjs node tests/segment-editor.browser.mjs
 * Optional BROWSER_FONT=/path/to/NotoSansJP.ttf for a machine without Japanese fonts.
 * Uses real UI + IndexedDB; only the external YouTube API is replaced.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin=process.env.APP_URL || 'http://127.0.0.1:5174/YListPlayer/';
const shots=process.env.SCREENSHOT_DIR || '/tmp/ylist-interface-tools/artifacts';
await fs.mkdir(shots,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const fixture=[{start:20,end:35},{start:38,end:50},{start:180,end:210}];
try {
 for(const width of (process.env.TEST_WIDTHS || '1440,390,320,900').split(',').map(Number)) {
  const context=await browser.newContext({hasTouch:true,viewport:{width,height:width===1440?900:844}});
  const page=await context.newPage();
  await page.addInitScript(()=>{
   window.holdPlayerReady=true;
   window.YT={PlayerState:{PLAYING:1,PAUSED:2,ENDED:0},Player:class {
    constructor(el,config){this.time=20;this.config=config;this.seeks=[];window.testPlayer=this;el.style.background='#101012';this.ready=()=>config.events.onReady({target:this});if(!window.holdPlayerReady)setTimeout(this.ready,0);}
    getCurrentTime(){return this.time}getDuration(){return 240}seekTo(t){this.seeks.push(t);this.time=t}playVideo(){this.config.events.onStateChange({data:1})}pauseVideo(){this.config.events.onStateChange({data:2})}destroy(){}
   }};
  });
  await page.route(/youtube\.com|youtu\.be|ytimg\.com/,r=>r.abort());
  if(process.env.BROWSER_FONT)await page.route('**/test-font.ttf',r=>r.fulfill({path:process.env.BROWSER_FONT,contentType:'font/ttf'}));
  await page.goto(origin);
  if(process.env.BROWSER_FONT){await page.addStyleTag({content:'@font-face {font-family: Roboto;src:url(/test-font.ttf);font-weight:100 900}'});await page.evaluate(()=>document.fonts.ready);}
  await page.screenshot({path:`${shots}/empty-${width}.png`,fullPage:true});
  await page.evaluate(async({fixture})=>{
   const {db}=await import('/YListPlayer/src/utils/db.ts');
   await db.playlists.add({id:1,name:'区間編集の確認',createdAt:1});
   await db.videos.bulkAdd([
    {id:1,playlistId:1,youtubeUrl:'https://www.youtube.com/watch?v=jfKfPfyJRdk',title:'編集サンプル — ピアノ練習',thumbnail:'',order:0,savedSegments:fixture}
   ]);
  },{fixture});
  await page.getByRole('combobox').click();await page.getByRole('option',{name:'区間編集の確認',exact:true}).click();
  await page.getByText('編集サンプル — ピアノ練習',{exact:true}).click();
  if(width<900){
   const edit=page.getByRole('checkbox',{name:'編集',exact:true});
   await edit.waitFor({state:'visible',timeout:3000});
   assert.equal(await edit.count(),1,'narrow screen must offer an edit toggle');
   assert.equal(await edit.isChecked(),false,'playback is the default');
   assert.equal(await page.getByRole('button',{name:'開始点をセット',exact:true}).count(),0);
   assert.equal(await page.getByRole('button',{name:'区間1を削除',exact:true}).count(),0);
   await page.getByRole('button',{name:/^区間 1 ·.*を再生$/}).waitFor();
   await edit.check();
  }
  const slider=page.getByRole('slider',{name:'再生位置'});
  assert.equal(await slider.count(),1,`${width}px: keyboard-accessible seek control must exist`);
  await slider.waitFor({state:'visible'});
  assert.equal(await page.getByRole('button',{name:'開始点をセット',exact:true}).isDisabled(),true);
  await page.getByText('プレイヤーを準備中です。読み込み後に区間を設定できます。',{exact:true}).waitFor();
  await page.evaluate(()=>{window.holdPlayerReady=false;window.testPlayer.ready();});
  await page.waitForTimeout(650);
  if(width<900){
   const edit=page.getByRole('checkbox',{name:'編集',exact:true});
   await edit.uncheck();
   const replay=page.getByRole('button',{name:/^区間 1 ·.*を再生$/});
   await replay.focus();await replay.press('Enter');
   assert.equal(await page.getByRole('slider',{name:'再生位置'}).count(),0);
   if(width===390){await page.mouse.move(0,0);await page.screenshot({path:`${shots}/after-playback-${width}.png`,fullPage:true});}
   await edit.check();
  }
  await page.mouse.move(0,0);

  if([1440,390].includes(width))await page.screenshot({path:`${shots}/after-${width}.png`,fullPage:true});
  if(width===1440){
   const create=page.locator('#segment-editor');
   assert.ok((await create.boundingBox()).height<=230,'creation controls should stay compact');
   const start=await page.getByRole('button',{name:'開始点をセット',exact:true}).boundingBox();
   const end=await page.getByRole('button',{name:'終了点をセット',exact:true}).boundingBox();
   const save=await page.getByRole('button',{name:'区間を保存',exact:true}).boundingBox();
   assert.ok(Math.abs(start.y-save.y)<=1 && Math.abs(end.y-save.y)<=1,'save must share the marker-button row');
   assert.ok(save.x>end.x,'save follows end-position control');
   const title=await page.getByRole('heading',{name:'再生区間を作成',exact:true}).boundingBox();
   const stop=await page.getByRole('checkbox',{name:'区間外で停止',exact:true}).boundingBox();
   assert.ok(Math.abs((stop.y+stop.height/2)-(title.y+title.height/2))<=6,'stop setting belongs beside the title');
  }
  // Growing the saved list must not steal space from the player.
  const savedSection=page.locator('section[aria-labelledby="saved-segments-title"]');
  const savedHeight=(await savedSection.boundingBox()).height;
  await page.evaluate(async()=>{const{db}=await import('/YListPlayer/src/utils/db.ts');await db.videos.update(1,{savedSegments:Array.from({length:12},(_,i)=>({start:i*18,end:i*18+8}))});});
  await page.getByRole('button',{name:/^区間 12 ·.*を再生$/}).waitFor({state:'attached'});
  assert.equal((await savedSection.boundingBox()).height,savedHeight,'segment count must not change section height');
  const list=page.getByRole('region',{name:'保存済み区間の一覧',exact:true});
  assert.equal(await list.count(),1,'saved items need an inner scroll region');
  assert.equal(await list.evaluate(el=>el.scrollHeight>el.clientHeight),true);
  await page.getByRole('button',{name:/^区間 12 ·.*を再生$/}).scrollIntoViewIfNeeded();
  assert.ok(await list.evaluate(el=>el.scrollTop)>0,'last item must be reachable by inner scrolling');
  await page.evaluate(async fixture=>{const{db}=await import('/YListPlayer/src/utils/db.ts');await db.videos.update(1,{savedSegments:fixture});},fixture);
  await page.getByRole('button',{name:/^区間 3 ·.*を再生$/}).waitFor({state:'attached'});
  await list.evaluate(el=>el.scrollTop=0);
  if(width===1440){
   const player=page.getByRole('region',{name:'動画プレイヤー',exact:true});
   const first=(await player.boundingBox()).height;
   await page.setViewportSize({width,height:1100});
   const taller=(await player.boundingBox()).height;
   assert.ok(taller-first>=195,'video must grow to use additional viewport height');
   assert.equal((await savedSection.boundingBox()).height,savedHeight);
   await page.setViewportSize({width,height:900});
  }
  // Resize the video without changing segment data or losing access to the editor.
  const frame=page.getByRole('region',{name:'動画プレイヤー',exact:true});
  const resize=page.getByRole('separator',{name:'動画の高さを変更',exact:true});
  assert.equal(await resize.count(),1,'video needs a draggable height separator');
  if(width===390){
   await page.setViewportSize({width:844,height:390});
   await page.waitForFunction(()=>document.querySelector('[aria-label=動画プレイヤー]').getBoundingClientRect().height<=390,{},{timeout:3000});
   assert.ok((await frame.boundingBox()).height<=390,'landscape video must fit the viewport');
   assert.ok(Number(await resize.getAttribute('aria-valuenow'))<=Number(await resize.getAttribute('aria-valuemax')),'announced height must fit the announced range');
   await page.setViewportSize({width:390,height:844});
  }

  await resize.scrollIntoViewIfNeeded();
  const initialHeight=(await frame.boundingBox()).height;
  const grip=await resize.boundingBox();
  await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();
  await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2+60,{steps:5});await page.mouse.up();
  assert.ok(Math.abs((await frame.boundingBox()).height-initialHeight-60)<=2,'drag adjusts height by pointer distance');
  await resize.focus();await resize.press('ArrowUp');
  assert.ok(Math.abs((await frame.boundingBox()).height-initialHeight-50)<=2,'keyboard can reduce height');
  await page.getByRole('button',{name:'動画を低くする',exact:true}).click();
  assert.ok(Math.abs((await frame.boundingBox()).height-initialHeight-40)<=2,'single-click resizing is available');
  await resize.focus();await resize.press('Home');
  assert.equal(Math.round((await frame.boundingBox()).height),width<900?200:240);
  if(width===1440){
   assert.ok((await savedSection.boundingBox()).height>savedHeight+20,'shrinking the video must expand the saved-section area');
   const panel=await savedSection.boundingBox();
   assert.ok(Math.abs(panel.y+panel.height-page.viewportSize().height+16)<=2,'saved section must reach the bottom content edge');
   if(width===1440)await page.screenshot({path:`${shots}/resized-list-${width}.png`,fullPage:true});
  }

  const touchGrip=await resize.boundingBox();
  const cdp=await context.newCDPSession(page);
  const touch={x:touchGrip.x+touchGrip.width/2,y:touchGrip.y+touchGrip.height/2,id:1};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...touch,y:touch.y+40}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(Math.round((await frame.boundingBox()).height),width<900?240:280,'touch drag changes video height');
  await resize.focus();await resize.press('End');
  assert.ok((await frame.boundingBox()).height<=page.viewportSize().height,'resize stays bounded');
  await page.waitForFunction(()=>{const r=document.querySelector('[role=separator]').getBoundingClientRect();return r.y>=0&&r.bottom<=innerHeight;},{},{timeout:1500});
  await page.getByRole('button',{name:'動画の高さを自動に戻す',exact:true}).click();
  await page.waitForFunction(height=>Math.abs(document.querySelector('[aria-label=動画プレイヤー]').getBoundingClientRect().height-height)<=2,initialHeight,{timeout:3000});
  assert.ok(Math.abs((await frame.boundingBox()).height-initialHeight)<=2,'automatic layout can be restored');
  assert.equal((await savedSection.boundingBox()).height,savedHeight);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  assert.equal(overflow,false,`${width}px: no horizontal scroll`);
  // Text-only 200% resize must keep the editor controls visible and unclipped.
  await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  const clipped=await page.locator('section[aria-labelledby]').evaluateAll(sections=>sections.flatMap(s=>[...s.querySelectorAll('button')].filter(b=>b.scrollWidth>b.clientWidth+1).map(b=>b.getAttribute('aria-label')||b.textContent)));
  assert.deepEqual(clipped,[],`${width}px: no clipped controls at 200% text size`);
  await page.evaluate(()=>document.documentElement.style.fontSize='');
  // An interrupted touch must resume player-time polling rather than leaving the editor frozen.
  await page.locator('.MuiSlider-root').evaluate(el=>{
   const r=el.getBoundingClientRect();
   const dispatch=(type,x)=>{const t=new Touch({identifier:0,target:el,clientX:r.x+r.width*x,clientY:r.y+r.height/2});el.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchcancel'?[]:[t],changedTouches:[t]}));};
   dispatch('touchstart',0.1);dispatch('touchmove',0.3);dispatch('touchcancel',0.3);
   window.testPlayer.time=21;
  });
  await page.waitForFunction(()=>document.querySelector('input[type=range]').value==='21',{},{timeout:2000});
  // The native range handles the complete flow using the keyboard.
  await slider.focus();await slider.press('Home');await slider.press('ArrowRight');
  await page.getByRole('button',{name:'開始点をセット',exact:true}).click();
  if(width<900){
   await page.getByRole('checkbox',{name:'編集',exact:true}).uncheck();
   assert.equal(await page.getByRole('slider',{name:'再生位置'}).count(),0);
   await page.getByRole('checkbox',{name:'編集',exact:true}).check();
   await page.getByRole('group',{name:'新しい区間の開始位置',exact:true}).waitFor();
  }
  await slider.focus();for(let i=0;i<4;i++)await slider.press('ArrowRight');
  await page.getByRole('button',{name:'終了点をセット',exact:true}).click();
  await page.getByRole('button',{name:'区間を保存',exact:true}).click();
  const segments=()=>page.evaluate(async()=>{const{db}=await import('/YListPlayer/src/utils/db.ts');return(await db.videos.get(1)).savedSegments;});
  await page.waitForFunction(async()=>{const{db}=await import('/YListPlayer/src/utils/db.ts');return(await db.videos.get(1)).savedSegments.length===4;});
  assert.deepEqual(await segments(),[{start:1,end:5},...fixture]);
  // Dragging updates the UI immediately, but sends one seek only after release.
  await page.getByRole('checkbox',{name:'区間外で停止'}).uncheck();
  const track=await page.locator('.MuiSlider-root').boundingBox();
  await page.evaluate(()=>window.testPlayer.seeks=[]);
  await page.mouse.move(track.x+track.width*0.2,track.y+track.height/2);await page.mouse.down();
  await page.mouse.move(track.x+track.width*0.5,track.y+track.height/2,{steps:5});
  assert.equal(await page.evaluate(()=>window.testPlayer.seeks.length),0);
  await page.mouse.up();
  assert.equal(await page.evaluate(()=>window.testPlayer.seeks.length),1);
  await page.getByRole('checkbox',{name:'区間外で停止'}).check();
  // Change a saved boundary and assert real database persistence, not mock calls.
  await page.getByRole('button',{name:'区間1の終了位置を1秒後へ',exact:true}).click();
  await page.waitForFunction(async()=>{const{db}=await import('/YListPlayer/src/utils/db.ts');return(await db.videos.get(1)).savedSegments[0].end===6;});
  // Inverted and overlapping edits are rejected without corrupting stored data.
  await slider.focus();await slider.press('Home');
  await page.getByRole('button',{name:'区間1の終了位置を現在位置に合わせる',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'終了位置は開始位置より後'}).waitFor();
  assert.deepEqual((await segments())[0],{start:1,end:6});
  await page.getByRole('button',{name:'区間2の終了位置を1秒後へ',exact:true}).click();
  await page.getByRole('button',{name:'区間2の終了位置を1秒後へ',exact:true}).click();
  await page.getByRole('button',{name:'区間2の終了位置を1秒後へ',exact:true}).click();
  await page.getByRole('button',{name:'区間2の終了位置を1秒後へ',exact:true}).click();
  assert.equal((await segments())[1].end,38);
  // A named button is reachable and activatable by keyboard, with a visible ring.
  const replay=page.getByRole('button',{name:/^区間 1 ·.*を再生$/});
  await slider.focus();await replay.focus();await replay.press('Enter');
  assert.equal(await slider.inputValue(),'1');
  const ring=await replay.evaluate(el=>({style:getComputedStyle(el).outlineStyle,width:getComputedStyle(el).outlineWidth}));
  assert.notEqual(ring.style,'none');assert.notEqual(ring.width,'0px');
  // Delete requires confirmation. Escape restores focus and preserves data.
  const remove=page.getByRole('button',{name:'区間1を削除',exact:true});
  await remove.click();await page.getByRole('dialog',{name:'区間1を削除しますか？',exact:true}).waitFor({timeout:3000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'dialog must fit narrow screen');
  assert.equal(await page.locator('.MuiDialogContent-root').evaluate(el=>el.scrollWidth<=el.clientWidth),true,'dialog content must not overflow');
  await page.keyboard.press('Escape');
  assert.equal((await segments()).length,4);
  assert.equal(await remove.evaluate(el=>el===document.activeElement),true);
  await remove.click();await page.getByRole('dialog').getByRole('button',{name:'削除',exact:true}).click();
  await page.waitForFunction(async()=>{const{db}=await import('/YListPlayer/src/utils/db.ts');return(await db.videos.get(1)).savedSegments.length===3;});
  // Removing the final row must leave keyboard focus at the saved-segment heading.
  for(let count=3;count>0;count--){
   await page.getByRole('button',{name:`区間${count}を削除`,exact:true}).click();
   await page.getByRole('dialog').getByRole('button',{name:'削除',exact:true}).click();
   await page.waitForFunction(async count=>{const{db}=await import('/YListPlayer/src/utils/db.ts');return(await db.videos.get(1)).savedSegments.length===count-1;},count);
  }
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'saved-segments-title','deleting last row must preserve usable focus');
  // Drafts reset on video switch; an empty editor remains usable.
  await page.evaluate(async()=>{const{db}=await import('/YListPlayer/src/utils/db.ts');await db.videos.add({id:2,playlistId:1,youtubeUrl:'https://www.youtube.com/watch?v=5qap5aO4i9A',title:'次の動画',thumbnail:'',order:1,savedSegments:[]});});
  await page.getByRole('button',{name:'開始点をセット',exact:true}).click();
  await page.getByText('次の動画',{exact:true}).click();
  await page.getByText('再生位置を選び、開始点と終了点をセットして保存します。',{exact:true}).waitFor();
  await page.getByRole('button',{name:'区間を保存',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'開始'}).waitFor();
  console.log(`PASS ${width}px: create, keyboard seek/replay/focus, boundary update/validation, delete confirmation, switch reset, overflow`);
  await context.close();
 }
} finally {await browser.close();}
