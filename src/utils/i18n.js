const translations = {
  en: {
    menuSubtitle: 'Multiplayer Neon Pong',
    playersTitle: 'Players',
    configureTitle: 'Configure',
    slots: 'SLOTS',
    cpu: 'CPU',
    cpuToggleTitle: 'Toggle CPU control',
    difficulty_superEasy: 'Super Easy',
    difficulty_easy: 'Easy',
    difficulty_normal: 'Normal',
    difficulty_hard: 'Hard',
    difficultyShort_superEasy: 'S.Easy',
    difficultyShort_easy: 'Easy',
    difficultyShort_normal: 'Normal',
    difficultyShort_hard: 'Hard',
    livesLabel: 'Lives',
    warningAllCpu: "⚠ All players are CPU — you'll be watching AI vs AI!",
    startGame: 'START GAME',
    playerPlaceholder: 'Player {index}',
    light: 'Light',
    dark: 'Dark',
    gameOver: 'GAME OVER',
    winner: '🏆 Winner: {name}',
    gameSaved: 'Game data saved automatically',
    restart: '🔄 Restart',
    menu: '📋 Menu',
    keys: 'KEYS',
    eliminated: '{name} ELIMINATED!',
    livesRemaining: '{name} — {count} {unit} left',
    life: 'life',
    lives: 'lives',
    go: 'GO!',
    side_left: 'Left',
    side_right: 'Right',
    side_top: 'Top',
    side_bottom: 'Bottom'
  },
  zh: {
    menuSubtitle: '多人霓虹乒乓',
    playersTitle: '玩家',
    configureTitle: '设置',
    slots: '位',
    cpu: '电脑',
    cpuToggleTitle: '切换电脑控制',
    difficulty_superEasy: '超简单',
    difficulty_easy: '简单',
    difficulty_normal: '普通',
    difficulty_hard: '困难',
    difficultyShort_superEasy: '超简',
    difficultyShort_easy: '简单',
    difficultyShort_normal: '普通',
    difficultyShort_hard: '困难',
    livesLabel: '生命',
    warningAllCpu: '⚠ 全部玩家都是电脑 — 你将观看 AI 对 AI！',
    startGame: '开始游戏',
    playerPlaceholder: '玩家 {index}',
    light: '亮色',
    dark: '暗色',
    gameOver: '游戏结束',
    winner: '🏆 胜者：{name}',
    gameSaved: '游戏数据已自动保存',
    restart: '🔄 重新开始',
    menu: '📋 菜单',
    keys: '按键',
    eliminated: '{name} 已淘汰！',
    livesRemaining: '{name} — 剩余 {count} {unit}',
    life: '条命',
    lives: '条命',
    go: '开始！',
    side_left: '左',
    side_right: '右',
    side_top: '上',
    side_bottom: '下'
  }
};

const format = (value, vars) => {
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, key) => {
    if (vars[key] === undefined || vars[key] === null) return match;
    return String(vars[key]);
  });
};

export const getText = (language, key, vars) => {
  const bundle = translations[language] || translations.en;
  const fallback = translations.en[key] || key;
  const value = bundle[key] || fallback;
  return format(value, vars);
};
