/**
 * @fileoverview 2D overlays
 * @date Created: Nov 13, 2024
 * @lastUpdated Last Updated: Dec 01, 2025
 * 
 */

// Start measuring the script execution time
const globalStartTime = performance.now();

// =============================
// IMPORTS 
// =============================

import {
  HD_SCALE,
  scaleToWindow,
  getOuterSize,

  GRID_BORDER,
	GRID_MARGIN,
	GRID_EXT_MARGIN,
	GRID_SCALE,

  CONSOLE_LOG_seedCheck,
  CONSOLE_LOG_dimentionsSendReceive,
  CONSOLE_LOG_canvas2dGrid,

  deterministicShuffle,

  FONT_FALLBACK,
  FONT_PRIMARY,
  FONT_SECONDARY,
  isFontReady

} from './config.js';

import { random, setSeed, getSeed } from './seed.js';
if (CONSOLE_LOG_seedCheck) console.log(`Canvas2D received seed: ${getSeed()}`);

// Read canvas dimensions
const { width: outerWidth, height: outerHeight } = getOuterSize();

// =============================
// GRID OVERLAY 
// =============================

/**
 * Helper function to reset text parameters
 * 
 */
function resetTextParams(context, fontSize, fontFamily = FONT_FALLBACK, fillStyle = 'black') {
  context.font = `${fontSize}px ${fontFamily}`;
  context.fillStyle = fillStyle;
}


/**
 * Grid generator
 * 
 * Grid cell positions are distorted using wave-based amplitude.
 * You can enable or disable cells borders and symbols in the cells.
 * 
 */
function drawGrid(
  context,
  border = GRID_BORDER,
  color,
  margin = GRID_MARGIN,
  externalMargin = GRID_EXT_MARGIN,
  chunkWidth,
  chunkHeight,
  scalingFactor = GRID_SCALE,
  showSymbols = true,
  waveParams = { amplitude: Math.PI / 2, frequencyX: 0.1, frequencyY: 0.2 },
  skipParams = { skipProbability: 0.4 }, // Probability to skip a cell
  repetitionParams = { genericRepeat: 50, ukrainianRepeat: 10, whitespaceRatio: random.pick([0.5, 0.6, 0.7, 0.8]) }, // Repetition settings
  opacity = 1.0
) {

  // Set opacity
  context.globalAlpha = opacity;

  // Calculate usable dimensions for the grid
  const adjustedWidth = outerWidth - 2 * externalMargin;
  const adjustedHeight = outerHeight - 2 * externalMargin;

  // Calculate cell size with minimum safety checks
  const minCellSize = externalMargin * 2; // Minimum size for a cell to render properly
  const maxCellSize = Math.min(adjustedWidth, adjustedHeight) / 2; // Ensure cells fit within canvas

  // Calculate cell size
  let squareSizeX = Math.max(
    minCellSize,
    Math.min(chunkWidth / scalingFactor, maxCellSize)
  );
  let squareSizeY = squareSizeX;
  let squareSize = squareSizeX;

  // Determine the number of cells in each direction with a lower bound of 1
  const numSquaresX = Math.max(1, Math.floor((adjustedWidth + margin) / (squareSizeX + margin)));
  const numSquaresY = Math.max(1, Math.floor((adjustedHeight + margin) / (squareSizeY + margin)));

  const totalCells = numSquaresX * numSquaresY;

  // Ensure totalCells is not zero
  if (totalCells <= 0) {
    console.warn("Grid dimensions are too small for any cells to render. Adjusting to minimum configuration.");
    return;
  }

  // Choose color styles
  const borderColor = color;
  const symbolColor = color;
  let borderWidth = border;

  // Symbol libraries
  const generic = '•○ ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 ░▒▓ ►◄↕‼¶§▬↑↓→←∟↔▲▼!#$%&()*+,-./:;<=>?@[\\]^_` ';
  const ukrainian = 'АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ ЇЇЇЇЇ ЇЇЇЇЇ ';
  const whitespace = ' ';
  const japaneseSets = [
    '亜 哀 愛 悪 握 圧 扱 安 暗 案',
    '以 位 依 偉 囲 委 威 尉 意 慰 易 為 異 移 維 緯 胃 衣 違 遺 医 井 域 育 一 壱 逸 稲 芋 印 員 因 姻 引 飲 院 陰 隠 韻',
    '右 宇 羽 雨 渦 浦 運 雲',
    '営 影 映 栄 永 泳 英 衛 詠 鋭 液 疫 益 駅 悦 謁 越 閲 円 園 宴 延 援 沿 演 炎 煙 猿 縁 遠 鉛 塩',
    '汚 凹 央 奥 往 応 押 横 欧 殴 王 翁 黄 沖 億 屋 憶 乙 卸 恩 温 穏 音',
    '下 化 仮 何 価 佳 加 可 夏 嫁 家 寡 科 暇 果 架 歌 河 火 禍 稼 箇 花 荷 華 菓 課 貨 過 蚊 我 画 芽 賀 雅 餓 介 会 解 回 塊 壊 快 怪 悔 懐 戒 拐 改 械 海 灰 界 皆 絵 開 階 貝 劾 外 害 慨 概 涯 街 該 垣 嚇 各 拡 格 核 殻 獲 確 穫 覚 角 較 郭 閣 隔 革 学 岳 楽 額 掛 潟 割 喝 括 活 渇 滑 褐 轄 且 株 刈 乾 冠 寒 刊 勘 勧 巻 喚 堪 完 官 寛 干 幹 患 感 慣 憾 換 敢 棺 款 歓 汗 漢 環 甘 監 看 管 簡 緩 缶 肝 艦 観 貫 還 鑑 間 閑 関 陥 館 丸 含 岸 眼 岩 頑 顔 願',
    '企 危 喜 器 基 奇 寄 岐 希 幾 忌 揮 机 旗 既 期 棋 棄 機 帰 気 汽 祈 季 紀 規 記 貴 起 軌 輝 飢 騎 鬼 偽 儀 宜 戯 技 擬 欺 犠 疑 義 議 菊 吉 喫 詰 却 客 脚 虐 逆 丘 久 休 及 吸 宮 弓 急 救 朽 求 泣 球 究 窮 級 糾 給 旧 牛 去 居 巨 拒 拠 挙 虚 許 距 漁 魚 享 京 供 競 共 凶 協 叫 境 峡 強 恐 恭 挟 教 橋 況 狂 狭 矯 胸 脅 興 郷 鏡 響 驚 仰 凝 暁 業 局 曲 極 玉 勤 均 斤 琴 禁 筋 緊 菌 襟 謹 近 金 吟 銀',
    '九 句 区 苦 駆 具 愚 虞 空 偶 遇 隅 屈 掘 靴 繰 桑 勲 君 薫 訓 群 軍 郡',
    '係 傾 刑 兄 啓 型 契 形 径 恵 慶 憩 掲 携 敬 景 渓 系 経 継 茎 蛍 計 警 軽 鶏 芸 迎 鯨 劇 撃 激 傑 欠 決 潔 穴 結 血 月 件 倹 健 兼 券 剣 圏 堅 嫌 建 憲 懸 検 権 犬 献 研 絹 県 肩 見 謙 賢 軒 遣 険 顕 験 元 原 厳 幻 弦 減 源 玄 現 言 限',
    '個 古 呼 固 孤 己 庫 弧 戸 故 枯 湖 誇 雇 顧 鼓 五 互 午 呉 娯 後 御 悟 碁 語 誤 護 交 侯 候 光 公 功 効 厚 口 向 后 坑 好 孔 孝 工 巧 幸 広 康 恒 慌 抗 拘 控 攻 更 校 構 江 洪 港 溝 甲 皇 硬 稿 紅 絞 綱 耕 考 肯 航 荒 行 衡 講 貢 購 郊 酵 鉱 鋼 降 項 香 高 剛 号 合 拷 豪 克 刻 告 国 穀 酷 黒 獄 腰 骨 込 今 困 墾 婚 恨 懇 昆 根 混 紺 魂',
    '佐 唆 左 差 査 砂 詐 鎖 座 債 催 再 最 妻 宰 彩 才 採 栽 歳 済 災 砕 祭 斎 細 菜 裁 載 際 剤 在 材 罪 財 坂 咲 崎 作 削 搾 昨 策 索 錯 桜 冊 刷 察 撮 擦 札 殺 雑 皿 三 傘 参 山 惨 散 桟 産 算 蚕 賛 酸 暫 残',
    '仕 伺 使 刺 司 史 嗣 四 士 始 姉 姿 子 市 師 志 思 指 支 施 旨 枝 止 死 氏 祉 私 糸 紙 紫 肢 脂 至 視 詞 詩 試 誌 諮 資 賜 雌 飼 歯 事 似 侍 児 字 寺 慈 持 時 次 滋 治 璽 磁 示 耳 自 辞 式 識 軸 七 執 失 室 湿 漆 疾 質 実 芝 舎 写 射 捨 赦 斜 煮 社 者 謝 車 遮 蛇 邪 借 勺 尺 爵 酌 釈 若 寂 弱 主 取 守 手 朱 殊 狩 珠 種 趣 酒 首 儒 受 寿 授 樹 需 囚 収 周 宗 就 州 修 愁 拾 秀 秋 終 習 臭 舟 衆 襲 週 酬 集 醜 住 充 十 従 柔 汁 渋 獣 縦 重 銃 叔 宿 淑 祝 縮 粛 塾 熟 出 術 述 俊 春 瞬 准 循 旬 殉 準 潤 盾 純 巡 遵 順 処 初 所 暑 庶 緒 署 書 諸 助 叙 女 序 徐 除 傷 償 勝 匠 升 召 商 唱 奨 宵 将 小 少 尚 床 彰 承 抄 招 掌 昇 昭 晶 松 沼 消 渉 焼 焦 照 症 省 硝 礁 祥 称 章 笑 粧 紹 肖 衝 訟 証 詔 詳 象 賞 鐘 障 上 丈 乗 冗 剰 城 場 壌 嬢 常 情 条 浄 状 畳 蒸 譲 醸 錠 嘱 飾 植 殖 織 職 色 触 食 辱 伸 信 侵 唇 娠 寝 審 心 慎 振 新 森 浸 深 申 真 神 紳 臣 薪 親 診 身 辛 進 針 震 人 仁 刃 尋 甚 尽 迅 陣',
    '酢 図 吹 垂 帥 推 水 炊 睡 粋 衰 遂 酔 錘 随 髄 崇 数 枢 据 杉 澄 寸',
    '世 瀬 畝 是 制 勢 姓 征 性 成 政 整 星 晴 正 清 牲 生 盛 精 聖 声 製 西 誠 誓 請 逝 青 静 斉 税 隻 席 惜 斥 昔 析 石 積 籍 績 責 赤 跡 切 拙 接 摂 折 設 窃 節 説 雪 絶 舌 仙 先 千 占 宣 専 川 戦 扇 栓 泉 浅 洗 染 潜 旋 線 繊 船 薦 践 選 遷 銭 銑 鮮 前 善 漸 然 全 禅 繕',
    '塑 措 疎 礎 祖 租 粗 素 組 訴 阻 僧 創 双 倉 喪 壮 奏 層 想 捜 掃 挿 操 早 曹 巣 槽 燥 争 相 窓 総 草 荘 葬 藻 装 走 送 遭 霜 騒 像 増 憎 臓 蔵 贈 造 促 側 則 即 息 束 測 足 速 俗 属 賊 族 続 卒 存 孫 尊 損 村',
    '他 多 太 堕 妥 惰 打 駄 体 対 耐 帯 待 怠 態 替 泰 滞 胎 袋 貸 退 逮 隊 代 台 大 第 題 滝 卓 宅 択 拓 沢 濯 託 濁 諾 但 達 奪 脱 棚 谷 丹 単 嘆 担 探 淡 炭 短 端 胆 誕 鍛 団 壇 弾 断 暖 段 男 談',
    '値 知 地 恥 池 痴 稚 置 致 遅 築 畜 竹 蓄 逐 秩 窒 茶 嫡 着 中 仲 宙 忠 抽 昼 柱 注 虫 衷 鋳 駐 著 貯 丁 兆 帳 庁 弔 張 彫 徴 懲 挑 朝 潮 町 眺 聴 脹 腸 調 超 跳 長 頂 鳥 勅 直 朕 沈 珍 賃 鎮 陳',
    '津 墜 追 痛 通 塚 漬 坪 釣',
    '亭 低 停 偵 貞 呈 堤 定 帝 底 庭 廷 弟 抵 提 程 締 艇 訂 逓 邸 泥 摘 敵 滴 的 笛 適 哲 徹 撤 迭 鉄 典 天 展 店 添 転 点 伝 殿 田 電',
    '吐 塗 徒 斗 渡 登 途 都 努 度 土 奴 怒 倒 党 冬 凍 刀 唐 塔 島 悼 投 搭 東 桃 棟 盗 湯 灯 当 痘 等 答 筒 糖 統 到 討 謄 豆 踏 逃 透 陶 頭 騰 闘 働 動 同 堂 導 洞 童 胴 道 銅 峠 匿 得 徳 特 督 篤 毒 独 読 凸 突 届 屯 豚 曇 鈍',
    '内 縄 南 軟 難',
    '二 尼 弐 肉 日 乳 入 如 尿 任 妊 忍 認',
    '寧 猫 熱 年 念 燃 粘',
    '悩 濃 納 能 脳 農',
    '把 覇 波 派 破 婆 馬 俳 廃 拝 排 敗 杯 背 肺 輩 配 倍 培 媒 梅 買 売 賠 陪 伯 博 拍 泊 白 舶 薄 迫 漠 爆 縛 麦 箱 肌 畑 八 鉢 発 髪 伐 罰 抜 閥 伴 判 半 反 帆 搬 板 版 犯 班 畔 繁 般 藩 販 範 煩 頒 飯 晩 番 盤 蛮',
    '卑 否 妃 彼 悲 扉 批 披 比 泌 疲 皮 碑 秘 罷 肥 被 費 避 非 飛 備 尾 微 美 鼻 匹 必 筆 姫 百 俵 標 氷 漂 票 表 評 描 病 秒 苗 品 浜 貧 賓 頻 敏 瓶',
    '不 付 夫 婦 富 布 府 怖 扶 敷 普 浮 父 符 腐 膚 譜 負 賦 赴 附 侮 武 舞 部 封 風 伏 副 復 幅 服 福 腹 複 覆 払 沸 仏 物 分 噴 墳 憤 奮 粉 紛 雰 文 聞',
    '丙 併 兵 塀 幣 平 弊 柄 並 閉 陛 米 壁 癖 別 偏 変 片 編 辺 返 遍 便 勉 弁',
    '保 舗 捕 歩 補 穂 募 墓 慕 暮 母 簿 倣 俸 包 報 奉 宝 峰 崩 抱 放 方 法 泡 砲 縫 胞 芳 褒 訪 豊 邦 飽 乏 亡 傍 剖 坊 妨 帽 忘 忙 房 暴 望 某 棒 冒 紡 肪 膨 謀 貿 防 北 僕 墨 撲 朴 牧 没 堀 奔 本 翻 凡 盆',
    '摩 磨 魔 麻 埋 妹 枚 毎 幕 膜 又 抹 末 繭 万 慢 満 漫',
    '味 未 魅 岬 密 脈 妙 民 眠',
    '務 夢 無 矛 霧 婿 娘',
    '名 命 明 盟 迷 銘 鳴 滅 免 綿 面',
    '模 茂 妄 毛 猛 盲 網 耗 木 黙 目 戻 問 紋 門 匁',
    '夜 野 矢 厄 役 約 薬 訳 躍 柳',
    '愉 油 癒 諭 輸 唯 優 勇 友 幽 悠 憂 有 猶 由 裕 誘 遊 郵 雄 融 夕',
    '予 余 与 誉 預 幼 容 庸 揚 揺 擁 曜 様 洋 溶 用 窯 羊 葉 要 謡 踊 陽 養 抑 欲 浴 翌 翼',
    '羅 裸 来 頼 雷 絡 落 酪 乱 卵 欄 濫 覧',
    '利 吏 履 理 痢 裏 里 離 陸 律 率 立 略 流 留 硫 粒 隆 竜 慮 旅 虜 了 僚 両 寮 料 涼 猟 療 糧 良 量 陵 領 力 緑 倫 厘 林 臨 輪 隣',
    '塁 涙 累 類',
    '令 例 冷 励 礼 鈴 隷 零 霊 麗 齢 暦 歴 列 劣 烈 裂 廉 恋 練 連 錬',
    '炉 路 露 労 廊 朗 楼 浪 漏 老 郎 六 録 論',
    '和 話 賄 惑 枠 湾 腕',
  ];

  // Combine the generic set and Ukrainian symbols
  const genericSymbolLibrary =
    generic.repeat(repetitionParams.genericRepeat) +
    ukrainian.repeat(repetitionParams.ukrainianRepeat);

  // Calculate counts of symbols and whitespaces
  const symbolCount = Math.floor(totalCells * (1 - repetitionParams.whitespaceRatio));
  const whitespaceCount = totalCells - symbolCount;

  // Pre-select symbols and whitespaces
  const symbols = Array.from({ length: symbolCount }, () =>
    Math.random() > 0.1 ? getGenericSymbol() : getJapaneseSymbol()
  );
  const whitespaces = Array.from({ length: whitespaceCount }, () => whitespace);

  // Combine and shuffle the array
  const preselectedArray = deterministicShuffle([...symbols, ...whitespaces], getSeed());

  // Calculate actual ratios
  const actualWhitespaces = preselectedArray.filter((char) => char === whitespace).length;
  const whitespaceRatio = actualWhitespaces / preselectedArray.length;

  // Adjust font size based on whitespace ratio
  const minFontSize = random.pick([24, 30]);
  const maxFontSize = random.pick([36, 48, 60, 72]);
  const fontScale = HD_SCALE;
  const fontSize = Math.round(
    (minFontSize + (maxFontSize - minFontSize) * (1 - whitespaceRatio)) * fontScale
  );

  if (CONSOLE_LOG_canvas2dGrid) {
    console.log(
      `Total cells: ${totalCells},
      Symbols: ${symbolCount}, Whitespaces: ${whitespaceCount},
      Font size: ${fontSize}`
    );
  }

  // Set text parameters
  resetTextParams(context, fontSize, FONT_FALLBACK, color);

  // Center the grid
  const totalGridWidth = squareSizeX * numSquaresX + margin * (numSquaresX - 1);
  const totalGridHeight = squareSizeY * numSquaresY + margin * (numSquaresY - 1);
  const offsetX = (outerWidth - totalGridWidth) / 2;
  const offsetY = (outerHeight - totalGridHeight) / 2;

  const calculateDistortionLevel = () => {
    const levels = {
      nothing: 0,
      low: Math.PI / 144,
      mid: Math.PI / 72,
      high: Math.PI / 36,
      extreme: Math.PI / 18,
    };
    return random.pick(Object.values(levels));
  };

  // Render the grid
  let index = 0;

  // Generate the grid
  for (let row = 0; row < numSquaresY; row++) {
    for (let col = 0; col < numSquaresX; col++) {

      const x = offsetX + col * (squareSizeX + margin);
      const y = offsetY + row * (squareSizeY + margin);

      // Determine if this cell should be skipped
      const shouldSkip = Math.random() < skipParams.skipProbability;

      const cellParams = {
        gridRotation: random.pick([true, false]),
        cellWaveDistortion: random.pick([true, true, false]),
        symbolRotation: random.pick([true, false]),
        gridAmplitude: calculateDistortionLevel(),
        cellAmplitude: calculateDistortionLevel(),
        symbolAmplitude: calculateDistortionLevel(),
        variableSize: random.pick([
          random.pick([
            true,
            false
          ]),
          random.pick([
            true,
            false, false, false, false, false,
            false, false, false
          ]), 
        ]),
        stableSize: random.pick([
          random.pick([
            true,
            false
          ]),
          random.pick([
            true,
            false, false, false, false, false,
          ]),
          random.pick([
            true,
            false, false, false, false, false,
            false, false, false, false, false,
          ]),  
        ])
      };

      if (!showSymbols && cellParams.variableSize) {
        squareSizeX = random.pick([chunkWidth, chunkHeight]) * random.pick([1, 1, 1, 2, 3, 4]) / random.range(0.02 * scalingFactor, 1 * scalingFactor);
        squareSizeY = random.pick([chunkWidth, chunkHeight]) * random.pick([1, 1, 1, 2, 3, 4]) / random.range(0.02 * scalingFactor, 1 * scalingFactor);
        borderWidth = random.pick([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, border]);
      } else if (!showSymbols && cellParams.stableSize) {
        squareSizeY = squareSizeX;
        borderWidth = random.pick([0, 0, 0, 0, border]);
      } else if (showSymbols) {
        squareSizeY = squareSizeX;
        borderWidth = 0;
      }

      context.save();

      // Apply cell wave distortion if enabled
      if (cellParams.cellWaveDistortion) {
      
        const waveAngle =
          waveParams.amplitude *
          Math.sin(col * waveParams.frequencyX + row * waveParams.frequencyY);
      
        if (!showSymbols && cellParams.variableSize) {
          context.translate(
            (Math.random() - 0.5) * (x + squareSizeX / 2),
            (Math.random() - 0.5) * (y + squareSizeY / 2)
          );
        } else {
          context.translate(x + squareSizeX / 2, y + squareSizeY / 2);
        }
      
        context.rotate(waveAngle * cellParams.cellAmplitude);
      
        if (Math.random() < random.pick([0.0, 0.1, 0.2, 0.3, 0.5, 0.8])) {
          context.translate(-(x + squareSizeX / 2), -(y + squareSizeY / 2));
        }
        
      }

      // Draw the cell border
      if (borderWidth > 0) {
        context.lineWidth = borderWidth;
        context.strokeStyle = borderColor;
        context.strokeRect(x, y, squareSizeX, squareSizeY);
      }

      // Draw the symbol if enabled and not skipped
      if (showSymbols && !shouldSkip) {
        const symbol = preselectedArray[index++];
        
        context.fillStyle = symbolColor;

        const textMetrics = context.measureText(symbol);
        const textX = x + (squareSize - textMetrics.width) / 2;
        const textY = y + squareSize / 2 + textMetrics.actualBoundingBoxAscent / 2;

        // Apply symbol-level rotation if enabled
        if (cellParams.symbolRotation) {
          context.save();
          context.translate(textX + textMetrics.width / 2, textY - textMetrics.actualBoundingBoxAscent / 2);
          context.rotate((Math.random() - 0.5) * 2 * cellParams.symbolAmplitude);
          context.fillText(symbol, -textMetrics.width / 2, textMetrics.actualBoundingBoxAscent / 2);
          if (Math.random() < random.pick([0.0, 0.1, 0.2, 0.3, 0.5, 0.8, 1.0])) {
            context.restore();
          }
        } else {
          context.fillText(symbol, textX, textY);
        }
        if (Math.random() < random.pick([0.0, 0.1, 0.2, 0.3, 0.5, 0.8, 1.0])) {
          context.restore();
          // Reapply text parameters after restoring the context
          resetTextParams(context, fontSize, FONT_FALLBACK, symbolColor);
        }
      }
      context.restore();
    }
  }
  // Reset globalAlpha to full opacity for other drawings
  context.globalAlpha = 1.0;

  // Helper functions
  function getGenericSymbol() {
    return genericSymbolLibrary.charAt(Math.floor(random.range(0, genericSymbolLibrary.length)));
  }

  function getJapaneseSymbol() {
    const currentSet = japaneseSets[Math.floor(random.range(0, japaneseSets.length))].split(' ');
    return currentSet[Math.floor(random.range(0, currentSet.length))];
  }
};

// Inner frame
function drawRoundedRectangle(context, numCols, chunkWidth, fillColor, transparent = true) {
  // Calculate dynamic frame dimensions
  const rectWidth = Math.max(
    Math.min(
      chunkWidth * random.range(2, numCols),
      (outerWidth - chunkWidth / random.range(1, 2, 3, 4))
    ) - GRID_EXT_MARGIN * 4,
    outerWidth / 3 // Ensure rectWidth is at least 1/3 of the canvas width
  );
  const rectHeight = outerHeight - 4 * GRID_EXT_MARGIN * random.range(1, 5);
  const cornerRadius = random.range(12, 16, 18, 24); // Dynamic corner radius

  // Calculate the position to center the rectangle
  const x = (outerWidth - rectWidth) / 2;
  const y = (outerHeight - rectHeight) / 2;

  // Save the context before applying transformations
  context.save();

  // Apply rotation around the center of the canvas
  const rotationAngle = random.pick([0, 0, 0, -Math.PI / 144, -Math.PI / 72, Math.PI / 72, Math.PI / 144]); // Subtle rotation
  context.translate(outerWidth / 2, outerHeight / 2); // Move to the center
  context.rotate(rotationAngle); // Rotate
  context.translate(-outerWidth / 2, -outerHeight / 2); // Move back

  // Draw the rectangle with rounded corners
  context.beginPath();
  context.moveTo(x + cornerRadius, y);
  context.lineTo(x + rectWidth - cornerRadius, y);
  context.quadraticCurveTo(x + rectWidth, y, x + rectWidth, y + cornerRadius);
  context.lineTo(x + rectWidth, y + rectHeight - cornerRadius);
  context.quadraticCurveTo(x + rectWidth, y + rectHeight, x + rectWidth - cornerRadius, y + rectHeight);
  context.lineTo(x + cornerRadius, y + rectHeight);
  context.quadraticCurveTo(x, y + rectHeight, x, y + rectHeight - cornerRadius);
  context.lineTo(x, y + cornerRadius);
  context.quadraticCurveTo(x, y, x + cornerRadius, y);
  context.closePath();

  // Fill the rectangle if not transparent
  if (!transparent) {
    context.fillStyle = fillColor;
    context.fill();
  }

  // Stroke the rectangle border
  context.lineWidth = GRID_BORDER * 2;
  context.strokeStyle = fillColor;
  context.stroke();

  // Restore the context to avoid affecting other drawings
  context.restore();
};


// =============================
// RENDER
// =============================

const canvas = document.getElementById('canvas2d');
const context = canvas.getContext('2d');

// Set the actual canvas resolution based on device pixel ratio
function getDevicePixelRatio() {
  return scaleToWindow ? window.devicePixelRatio || 1 : 1;
}
const dpr = getDevicePixelRatio();
canvas.width = outerWidth * dpr;
canvas.height = outerHeight * dpr;

context.scale(dpr, dpr);

// Resize the canvas visually to fit the browser window height
function resizeAndCenterCanvas() {
  const canvas2d = document.getElementById('canvas2d');
  const aspectRatio = outerWidth / outerHeight;
  const windowHeight = window.innerHeight;
  const windowWidth = window.innerWidth;

  // Calculate scaled dimensions to fit the browser
  const scaledHeight = windowHeight;
  const scaledWidth = scaledHeight * aspectRatio;

  // Update CSS only for visual scaling
  canvas2d.style.width = `${scaledWidth}px`;
  canvas2d.style.height = `${scaledHeight}px`;
  canvas2d.style.left = `${(windowWidth - scaledWidth) / 2}px`;
  canvas2d.style.top = `${(windowHeight - scaledHeight) / 2}px`;
}

if (scaleToWindow) {
  // Listen to window resize events
  window.addEventListener('resize', resizeAndCenterCanvas);

  // Call the resize function initially
  resizeAndCenterCanvas();
}

window.addEventListener('chunkDimensionsReady', (event) => {
  const { cols, additionalCols, rows, chunkWidth, chunkHeight, colorScheme } = event.detail;

  if (CONSOLE_LOG_dimentionsSendReceive) {
  console.log(`Received chunkDimensions in Canvas2D:
    cols: ${cols},
    additionalCols: ${additionalCols},
    rows: ${rows},
    chunkWidth: ${chunkWidth},
    chunkHeight: ${chunkHeight},
    colorScheme: ${colorScheme}`);
  }

  // Clear the entire canvas
  context.clearRect(0, 0, outerWidth, outerHeight);

  const borderColor = colorScheme[Math.floor(Math.random() * colorScheme.length)];
  const symbolColor = colorScheme[Math.floor(Math.random() * colorScheme.length)];
  const numCols = cols + additionalCols;

  context.save();
  context.translate(0, 0);

  // Draw a frame
  drawRoundedRectangle(context, numCols, chunkWidth, symbolColor, true);

  // Draw a grid with symbols
  drawGrid(
    context,
    0, // No border
    symbolColor,
    GRID_MARGIN,
    GRID_EXT_MARGIN,
    chunkWidth,
    chunkHeight,
    Math.floor(numCols + numCols * GRID_SCALE),
    true // With symbols
  );

  // Draw a grid without symbols
  drawGrid(
    context,
    GRID_BORDER,
    borderColor,
    GRID_MARGIN,
    GRID_EXT_MARGIN,
    chunkWidth,
    chunkHeight,
    Math.floor(numCols + numCols * GRID_SCALE),
    false // No symbols
  );

  context.restore();

  // Display "Loading..." on the canvas
  function loading() {
    const loadingElement = document.createElement('div');
    loadingElement.id = 'loadingText';

    const loadingMessages = {
      en: "Loading",
      ja: "ローディング",
      //uk: "Завантаження",
      //de: "Laden",
      //es: "Cargando",
      //it: "Caricamento",
      //fr: "Chargement"
    };
    
    const selectedLanguage = Object.keys(loadingMessages)[Math.floor(Math.random() * 2)];
    const loadingText = loadingMessages[selectedLanguage];

    loadingElement.textContent = `[ ${loadingText} ]`.toUpperCase();

    // Dynamically calculate font size based on window size
    const baseFontSize = Math.max(window.innerWidth, window.innerHeight) * 0.032; // x% of the bigger dimension
    
    // Style the loading text to be centered over the canvas
    Object.assign(loadingElement.style, {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      fontSize: `${baseFontSize}px`,
      color: borderColor,
      fontFamily: FONT_FALLBACK,
      zIndex: '1000', // Ensure it's on top of the canvas
      pointerEvents: 'none' // Allow clicks to pass through to canvas
    });
    
    document.body.appendChild(loadingElement);

    // Update font size on window resize
    window.addEventListener('resize', () => {
      const newFontSize = Math.min(window.innerWidth, window.innerHeight) * 0.05;
      loadingElement.style.fontSize = `${newFontSize}px`;
    });
  }

  // Clear the "Loading..." text
  function clearLoading() {
    const loadingElement = document.getElementById('loadingText');
    if (loadingElement) {
      loadingElement.remove();
    }
  }

  // Display loading message initially
  loading();

  // Clear loading on DOMContentLoaded (fires sooner than window.load)
  document.addEventListener('DOMContentLoaded', () => {
    clearLoading();
  });

  // As a backup, clear loading after a timeout (handles edge cases)
  setTimeout(() => {
    clearLoading();
  }, 5000);  // Fallback after 5 seconds

  // Log the script execution time
  window.addEventListener('load', () => {
    const globalEndTime = performance.now();

    // Clear loading message once rendering is complete
    clearLoading();

    console.log(`Canvas2D render time: ${((globalEndTime - globalStartTime) / 1000).toFixed(2)} s`);
  });

});
