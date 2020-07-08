// ==UserScript==
// @id             IITC-visualize-Resonators-Modules
// @name           IITC plugin: Visualize Resonators and Modules
// @author         sige1002
// @category       Layer
// @version        0.0.1.20200613.01
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @description    [2020-05-25]Visualize Resonators and Modules by getPortalDetail.
// @include        https://*.ingress.com/intel*
// @include        http://*.ingress.com/intel*
// @match          https://*.ingress.com/intel*
// @match          http://*.ingress.com/intel*
// @include        https://*.ingress.com/mission/*
// @include        http://*.ingress.com/mission/*
// @match          https://*.ingress.com/mission/*
// @match          http://*.ingress.com/mission/*
// @grant          none
// ==/UserScript==

function wrapper(plugin_info) {
  // ensure plugin framework is there, even if iitc is not yet loaded
  if (typeof window.plugin !== 'function') window.plugin = function() {};

  // PLUGIN START ////////////////////////////////////////////////////////
  // use own namespace for plugin
  window.plugin.visualizeResosMods = function() {};
  var self = window.plugin.visualizeResosMods;

  //生データ管理
  /*
  どうしようかなー。データ管理はここに持たせたいし。
  一覧をペチペチするだけで読んだ状態をリストアしてほしいし。
  貼っつけたJSONを元に描画して欲しさもあるし。
  要はRAWdataの使いみちだよなー。

  window.plugin.visualizeResosMods.dumpStorage = {
    rawDataTmp:[],
    //一時セットをクリア
    clearTmp:function(){
      this.rawDataTmp = [];
    },
    //一時セットに追加
    addTmp:function(data){
    },
    //一時セットを永続化
    addSet:function(){
      //セット上限は5まで
      //LocalStorageに保存
    },
    //localStorageから一時ストレージをロード
    loadSet:function(){
    },
    //localStorageから一時ストレージをロード
    loadSet:function(){
    },
  };*/

  //データ宣言・初期化
  self.init = function(){
    //レイヤー名
    self.LAYERNAME = 'It is My Turn';
    //スキャン候補ポータル一覧
    self.portalsToScan = [];
    self.scanIndex = 0;
    //スキャン生データ
    self.rawData = [];
    //
    self.myTurnPortals = [];
    //スキャン間隔
    self.interval = 1800;//初期値
    self.intervalBaseValue = 300;//ウェイト基本値
    self.intervalRandom = 1500;//ランダムウェイト加算上限
    //スキャンフィルタ
    self.filterScanByMinLv = 6;//
    self.filterScanByFaction = "R";//
    //設定からロード
    if(!window.localStorage.getItem("plugin-visualizeResosMods")){window.localStorage.setItem("plugin-visualizeResosMods",JSON.stringify({"foo":"bar"}));}
    self.lstmp = JSON.parse(window.localStorage.getItem("plugin-visualizeResosMods"));
    for(var i in self.lstmp){
      self[i] = self.lstmp[i];
    }
  };

  self.setupCSS = function() {
    $('<style>').prop('type', 'text/css').html(''
      + '.visualizeModReso {'
//        + 'color:black;'
//        + 'font-size:' + setting_.labelFontSize + 'px;'
        + 'font-size:12px;'
        // + 'line-height:' + (setting_.labelFontSize + 1) + 'px;'
        // + 'line-height:' + (setting_.labelFontSize) + 'px;'
        + 'line-height: 12px;'
        + 'text-align:center;'
        + 'margin:0; padding:0px;'
        // + 'padding:' + LABEL_PADDING + 'px;'
        + 'overflow:visible;'
        //+ 'overflow:hidden;'
        + 'white-space:nowrap;'
        //+ 'border-style:solid;border-width:thin;'
        + 'pointer-events:none;'
      + '}'
      + '.visualizeModReso-textbox {'
        + 'position: relative;'
        + 'width: 100%;'
        + 'height: 100%;'
        + 'margin:0; padding:0;'
        //+ 'border-style:solid;border-width:thin;'
        + 'text-align: center;'
      + '}'
      + '.visualizeModReso-textbox-inner {'
        + 'position: absolute;'
        + 'width: 100%;'
        + 'margin:0; padding:0;'
        + 'text-align: center;'
        // + 'text-align: center;'
        //+ 'bottom: 0;'
        //+ 'border-style:solid;border-width:thin;'
      + '}'
      + '.visualizeModReso-text-normal {text-shadow:1px 1px #000,1px -1px #000,-1px 1px #000,-1px -1px #000, 0 0 5px #000;}'
      + '.visualizeModReso-text-own {text-shadow:1px 1px #f00,1px -1px #f00,-1px 1px #f00,-1px -1px #f00;}'
    ).appendTo('head');
  };

  //[*今見えている]範囲の[*p7以上]の[*青]のポータル一覧を作って集計に回す
  self.autoscan = function(){
    //設定画面の内容を保存
    self.lstmp.filterScanByFaction = $("[name='visualizeResosMods_filterScanByFaction']").val();
    self.lstmp.filterScanByMinLv = $("[name='visualizeResosMods_filterScanByMinLv']").val();
    window.localStorage.setItem("plugin-visualizeResosMods",JSON.stringify(self.lstmp));

    self.rawData = [];

    //スキャン実行中に再投入されたらキャンセル動作とみなす
    if(self.portalsToScan.length > 0){
      $("#bt_visualizeResosMods_start").text("Stopping...");
      self.portalsToScan = [];//キューを空にして終わらせる。
      return false;
    }

    //スキャンするポータルの一覧
    self.portalsToScan = self.getPortalsByBound(
      self.lstmp.filterScanByMinLv,
      self.lstmp.filterScanByFaction
    );
    //スキャンキュー実行
    self.scanIndex = 0;
  	self.intervalHandler();
  };

  //スキャンキューのウェイトつき実行
  self.intervalHandler = function(){
    $("#bt_visualizeResosMods_start").text("Cancel");

    if (!self.portalsToScan[self.scanIndex]) {
      //全件終了
      $("#dv_visualizeResosMods_msg").text("");
      $(".ui-visualizeResosMods-dialog .ui-dialog-titlebar span.ui-dialog-title").text("Visualize Resos & Mods");
      $("#bt_visualizeResosMods_start").text("START Scan Resos & Mods");
      window.changePortalHighlights(self.LAYERNAME);//ハイライト再描画
      //Rawdataダンプ
      self.dumpRawData();
      //スキャン候補一覧クリア
      self.portalsToScan = [];
    }else{
      //1件処理（APIコール消費）
      var guid = self.portalsToScan[self.scanIndex].guid;
      window.portalDetail.request(guid);
      var progress = self.scanIndex +
        "/" + self.portalsToScan.length;
      $("#dv_visualizeResosMods_msg").text("Scan:" + progress);
      $(".ui-visualizeResosMods-dialog .ui-dialog-titlebar span.ui-dialog-title").text("Scan:" + progress);
      console.info("MyResoMod:"+progress+", got "+guid);
      //次の処理
      self.interval = Math.random() * self.intervalRandom + self.intervalBaseValue;
      setTimeout(self.intervalHandler, self.interval);
      window.changePortalHighlights(self.LAYERNAME);//ハイライト再描画
      self.scanIndex++;
    }
  }

  //ポータル一覧の取得：ウィンドウの範囲内の一覧を返す
  self.getPortalsByBound = function(minLv, faction){
    //minLv:フィルタ：最低ポータルレベル, faction:フィルタ：陣営["E"|"R"|""]
    var portals = [];
    var bound = window.map.getBounds();

    for(var guid in window.portals){
      var pd = window.portals[guid];
      //console.log(pd);
      if(pd.options.level){
        var data = pd.options.data;
        var ltmp = L.latLng(data.latE6 / 1000000, data.lngE6 / 1000000);
        var scanflag = 0;
        //
        // フィルタ：ここでスキャンするポータルを絞り込む
        if(minLv != ""){
          scanflag += (pd.options.level > parseInt(minLv))?1:0; //フィルタ：最低レベル
        }else{
          scanflag += (pd.options.level > 0)?1:0; //フィルタ：白ぽ以外スキャン
        }
        if(faction != ""){
          scanflag += (data.team == faction)?1:0; //フィルタ：陣営
        }else{
          scanflag++;
        }
        //
        if(scanflag == 2){
          //console.log("Filter:"+pd.options.level+","+data.team+","+scanflag);
          if(bound.contains(ltmp)){
            portals.push({
              guid: guid,
              name: data.title,
              lat: data.latE6 / 1000000,
              lng: data.lngE6 / 1000000,
//              team: data.team,
            });
          }
        }
      }
    }
    return portals;
  };

  //portalDetailLoaded hookから回ってきたデプロイ詳細を集計に積む
  self.countPortalDetail = function(data){
    console.info("visualizeResosMods.countPortalDetail", data);

    var date = new Date() ;
    var unixtimems = date.getTime() ;
    var unixtime = Math.floor( unixtimems / 1000 ) ;
    self.rawData[self.rawData.length] = {
      at:unixtime,
      guid:data.guid,
      rawdata:data.details
    };

    var mods = data.details.mods;

    var modContents = [];
    var modMines = 0;
    var modEmpties = 0;
    for (var m = 0; m < 4; ++m) {
      if (mods[m]) {
        var modOwner = mods[m].owner;
        var modName = mods[m].name || '_';
        switch(modName) {
          case 'Portal Shield':
            modName = 'PS';
            break;
          case 'Multi-hack':
            modName = 'MH';
            break;
          case 'Heat Sink':
            modName = 'HS';
            break;
          case 'Link Amp':
            modName = 'LA';
            break;
          case 'Force Amp':
            modName = 'FA';
            break;
          case 'Turret':
            modName = 'Tu';
            break;
          case 'Aegis Shield':
            modName = 'AS';
            break;
          case 'SoftBank Ultra Link':
            modName = 'UL';
            break;
          case 'Ito En Transmuter (+)':
            modName = '茶+';
            break;
          case 'Ito En Transmuter (-)':
            modName = '茶-';
            break;
          default:
            // nothing to do
            break;
        }
        var modRarity = mods[m].rarity.capitalize().replace(/_/g, ' ') || '(unknown rarity)';
        var modColor = '#000000';
        switch(modRarity) {
          case 'Very rare':
            modRarity = 'VR';
            modColor = '#b08cff';
            break;
          case 'Rare':
            modRarity = 'R';
            modColor = '#73a8ff';
            break;
          case 'Common':
            modRarity = 'C';
            modColor = '#8cffbf';
            break;
        }
        var isMine = modOwner === window.PLAYER.nickname;
        if(isMine) ++modMines;
        modContents.push({name: modName, rarity: modRarity, owner: modOwner, color: modColor, isMine: isMine});
      } else {
        ++modEmpties;
        modContents.push({name: '_', rarity: '_', owner: '_', color: '#000000', isMine: false});
      }
    }

    var initialAtMyMods = 2 - modMines;
    var atMyMods = (modEmpties > 0 && data.details.team === 'E') ? (initialAtMyMods < 0) ? 0
                                                                                         : (initialAtMyMods > modEmpties) ? modEmpties
                                                                                                                          : initialAtMyMods
                                                                 : 0;

    var myTurn = self.myTurnPortals[data.guid];
    if (myTurn && myTurn.modsMarker) self.modsLayer.removeLayer(myTurn.modsMarker);
    var modsMarker = L.marker([data.details.latE6/1E6, data.details.lngE6/1E6], {
      icon: L.divIcon({
        className: 'visualizeModReso',
        html: self.buildModsHtml(modContents, data.details.team, modEmpties, atMyMods),
        iconAnchor: [-10, -10],
      })
    });
    self.modsLayer.addLayer(modsMarker);


    var resos = data.details.resonators;

    var resoContents = [];
    var r8s = 0;
    var r8Mines = 0;
    for (var r = 0; r < 8; ++r) {
      var resoOwner = resos[r] ? resos[r].owner : '_';
      var resoLevel = resos[r] ? resos[r].level : 0;
      if (resoLevel === 8) {
        ++r8s;
        if ( resoOwner === window.PLAYER.nickname) ++r8Mines;
      }
      resoContents.push({owner: resoOwner, level: resoLevel});
    }

    var initialAtMy8Resos = 2 - r8Mines;
    var initialAt8Resos = 8 - r8s;
    var atMy8Resos = (r8s < 8 && data.details.team === 'E') ? (initialAtMy8Resos < 0) ? 0
                                                                                      : (initialAt8Resos < initialAtMy8Resos) ? initialAt8Resos
                                                                                                                              : initialAtMy8Resos
                                                            : 0;

    myTurn = {atMyMods: atMyMods, atMy8Resos: atMy8Resos, modsMarker: modsMarker, resosMarker: null};
    self.myTurnPortals[data.guid] = myTurn;

    if (r8s == 64) return; // P8
    if (myTurn.resosMarker) self.resosLayer.removeLayer(myTurn.resosMarker);
    var resosMarker = L.marker([data.details.latE6/1E6, data.details.lngE6/1E6], {
      icon: L.divIcon({
        className: 'visualizeModReso',
        html: self.buildResosHtml(resoContents, data.details.team, r8s, atMy8Resos),
        iconAnchor: [-10, 18],
      })
    });
    self.resosLayer.addLayer(resosMarker);
    myTurn.resosMarker = resosMarker;
    self.myTurnPortals[data.guid] = myTurn;

  };

  self.buildModsHtml = function(modContents, team, modEmpties, atMyMods) {
    var mods = [];
    for (var m = 0; m < modContents.length; ++m) {
      var style = modContents[m].isMine ? 'visualizeModReso-text-own' : 'visualizeModReso-text-normal';
      var span = modContents[m].name === '_' ? '<span>' + modContents[m].name + '</span>'
                                            : '<span class="' + style + '" style="color:'+ modContents[m].color + '">' + modContents[m].name + '</span>';
      mods.push(span);
    }
    return '<div class="visualizeModReso-textbox"><div class="visualizeModReso-textbox-inner">' + mods.join('|') + '</div></div>';
  };

  self.buildResosHtml = function(resoContents, team, r8s, atMy8Resos) {
    /*
    var resos = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    var myResos = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (var r = 0; r < resoContents.length; ++r) {
      var reso = resoContents[r];
//      var style = 'visualizeModReso-text-normal';
      if (reso.owner === window.PLAYER.nickname) {
//        style = 'visualizeModReso-text-own';
        var myLevel = myResos[reso.level];
        myResos[reso.level] = ++myLevel;
      } else {
        var level = resos[reso.level];
        resos[reso.level] = ++level;
      }
    }
    */
    if (r8s == 8) return '';
    var r8info = '@';
    if (team === 'E') {
      r8info += (atMy8Resos + '/' + (8 - r8s));
    } else {
      r8info += (8 - r8s);
    }
    return '<div class="visualizeModReso-textbox"><div class="visualizeModReso-textbox-inner"><span class="visualizeModReso-text-normal" style="color:#9627F4">' + r8info + '</span></div></div>';
  };

  //設定画面の表示
  self.openSettingDialog = function(){
    var html_0 = [
      '<style>',
      '.ui-dialog-buttonset{text-align:center;}',
      '.dv_visualizeResosMods_well{margin:0 0 0.4em 0;border:1px solid #666;padding:0.4em;background-color:#000;}',
      '#dv_visualizeResosMods_scanstat{line-height:1.2;}',
      '#dv_visualizeResosMods_scanstat button{border-color:#9f0;color:white;background-color:#390;}',
      '#dv_visualizeResosMods_setting *{line-height:1.4;}',
      '.dv_visualizeResosMods_hed{font-weight:bold;}',
      '#dv_visualizeResosMods_help *{line-height:1.4;font-size:85%;}',
      '#tx_visualizeResosMods_rawdata{width:100%;height:10em;font-size:70%;margin-top:6px;}',
      '</style>',
      '<div>',
      '<div id="dv_visualizeResosMods_scanstat" class="dv_visualizeResosMods_well">',
      '<button onclick="window.plugin.visualizeResosMods.autoscan()" id="bt_visualizeResosMods_start">START Scan Resos & Mods</button>',
      '<span id="dv_visualizeResosMods_msg"></span>',
      '</div>',
      '<div id="dv_visualizeResosMods_setting" class="dv_visualizeResosMods_well"></div>',
      '<div id="dv_visualizeResosMods_help" class="dv_visualizeResosMods_well"></div>',
      '<div id="dv_visualizeResosMods_rawdata" class="dv_visualizeResosMods_well">',
      '<button onclick="window.plugin.visualizeResosMods.dumpRawData()">Dump Scanned RawData</button>',
      '<textarea id="tx_visualizeResosMods_rawdata"></textarea>',
      '</div>',
      '</div>',
    ];
    dialog({
      html: html_0.join("\n"),
      id: 'plugin-visualizeResosMods-dialog',
      dialogClass: 'ui-visualizeResosMods-dialog',
      title: 'Visualize Resos & Mods',
      width: 320,
      height: 320,
      resizable: true
    });
    $("#dv_visualizeResosMods_setting").html([
      '<div class="dv_visualizeResosMods_hed">Scan Setting</div>',
      'Filter:Faction:',
      '<select name="visualizeResosMods_filterScanByFaction">',
      '<option value="">Both</option>',
      '<option value="R">RES</option>',
      '<option value="E">ENL</option>',
      '</select>',
      '<br>',
      'Filter:Min Pt Lv:',
      '<select name="visualizeResosMods_filterScanByMinLv">',
      '<option value="">ALL</option>',
      '<option value="2">&gt;= P3</option>',
      '<option value="3">&gt;= P4</option>',
      '<option value="4">&gt;= P5</option>',
      '<option value="5">&gt;= P6</option>',
      '<option value="6">&gt;= P7</option>',
      '<option value="7">P8 only</option>',
      '</select>',
      '<br>',
    ].join("\n"));
    $("#dv_visualizeResosMods_help").html([
      "<span><b>Usage:</b>",
      "・HighlighterでIt is My Turnを選択するよ",
      "・toolboxペインの「Scan Resos & Mods」をタップ→設定選んでスキャン→設定に該当するポータル全部にAPIコールを消費して各ポータルの状態を読みに行くよ",
      "・modが1つ投入可能なところは黄色、2つ投入可能なところは赤で表示するよ",
      "・8レゾが足りないところは紫色(8レゾ色)の破線(Canvas render時)で強調表示するよ",
      "・APIコールを消費するんで、調子こくとIntelからbanされるよ</span>",
    ].join("<br>\n"));
    //
    $("[name='visualizeResosMods_filterScanByFaction']").val(self.lstmp.filterScanByFaction);
    $("[name='visualizeResosMods_filterScanByMinLv']").val(self.lstmp.filterScanByMinLv);
  };

  //RawDataダンプの表示
  self.dumpRawData = function(){
    $("#tx_visualizeResosMods_rawdata").text(JSON.stringify(self.rawData));
  };

  self.highlight = function(data) {
    if(!data.portal){return false;}
    if(!data.portal.options){return false;}
    if(!data.portal.options.guid){return false;}

//  self.myTurnPortals[data.guid] = {atMyMods: atMyMods, atMy8Resos: atMy8Resos};
    if(data.portal.options.guid in self.myTurnPortals){
      //window.setMarkerStyle(data.portal, data.portal.options.guid === window.selectedPortal);

      var myTurn = self.myTurnPortals[data.portal.options.guid];
      if(myTurn.atMyMods > 0) {
        var color = myTurn.atMyMods === 2 ? 'red' : 'yellow';
        data.portal.setStyle({fillColor: color, fillOpacity: 1.0});
      }
      if(myTurn.atMy8Resos > 0) {
        var styleOptions = window.getMarkerStyleOptions(data.portal.options);
        var radius = styleOptions.radius;
        var weight = styleOptions.weight;
        var opacity = styleOptions.opacity;
        switch(myTurn.atMy8Resos) {
          case 2:
            radius += 2;
            weight += 2;
//            opacity = 1;
            break;
          case 1:
//            radius += 1;
//            weight += 1;
//            opacity = 0.75;
            break;
        }
        data.portal.setStyle({color: '#9627F4', radius: radius, weight: weight, opacity: opacity});
      }
    }

  };

  var setup = function() {
    self.init();
    self.setupCSS();
    self.modsLayer = new L.LayerGroup();
    self.resosLayer = new L.LayerGroup();
    window.addLayerGroup('Modules', self.modsLayer, false);
    window.addLayerGroup('Resonators', self.resosLayer, false);
    $('#toolbox').append(' <a id="href_visualizeResosMods_dump" target="_blank">Scan Resos & Mods</a>');
    $("#href_visualizeResosMods_dump").on('click',function(){self.openSettingDialog();});
    window.addHook('portalDetailLoaded', self.countPortalDetail);
    window.addPortalHighlighter(self.LAYERNAME, self.highlight);
  };

  // PLUGIN END //////////////////////////////////////////////////////////

  setup.info = plugin_info; //add the script info data to the function as a property
  if (!window.bootPlugins) window.bootPlugins = [];
  window.bootPlugins.push(setup);
  // if IITC has already booted, immediately run the 'setup' function
  if (window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = {
  version: GM_info.script.version,
  name: GM_info.script.name,
  description: GM_info.script.description
};
script.appendChild(document.createTextNode('(' + wrapper + ')(' + JSON.stringify(info) + ');'));
(document.body || document.head || document.documentElement).appendChild(script);