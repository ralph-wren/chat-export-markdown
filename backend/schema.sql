CREATE TABLE IF NOT EXISTS  users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS  settings (
  user_id TEXT PRIMARY KEY,
  encrypted_data TEXT NOT NULL,
  salt TEXT NOT NULL,
  iv TEXT NOT NULL,
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  error TEXT,
  stack TEXT,
  context TEXT,
  user_agent TEXT,
  url TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- API 密钥表：存储共享的 NVIDIA API 密钥
CREATE TABLE IF NOT EXISTS  api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL DEFAULT 'nvidia',
  api_key TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  usage_count INTEGER DEFAULT 0,
  last_used_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 用户-密钥分配表：记录每个用户分配的密钥
CREATE TABLE IF NOT EXISTS  user_api_key_assignments (
  user_id TEXT PRIMARY KEY,
  api_key_id INTEGER NOT NULL,
  assigned_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
);

-- 插入 5 个 NVIDIA API 密钥

-- ==================== 文章发布统计系统 ====================

-- 发布平台表
CREATE TABLE IF NOT EXISTS platforms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,           -- 平台名称：toutiao, weixin, zhihu 等
  display_name TEXT NOT NULL,          -- 显示名称：今日头条, 微信公众号, 知乎
  icon TEXT,                           -- 平台图标 URL 或 emoji
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 账号表：存储各平台的账号信息
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform_id INTEGER NOT NULL,
  account_id TEXT NOT NULL,            -- 平台上的账号 ID
  account_name TEXT,                   -- 账号名称/昵称
  avatar_url TEXT,                     -- 头像 URL
  extra_info TEXT,                     -- JSON 格式的额外信息
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (platform_id) REFERENCES platforms(id),
  UNIQUE(platform_id, account_id)
);

-- 文章表：存储发布的文章信息
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  article_id TEXT NOT NULL,            -- 平台上的文章 ID
  title TEXT NOT NULL,                 -- 文章标题
  content_summary TEXT,                -- 内容摘要
  cover_image TEXT,                    -- 封面图 URL
  article_url TEXT,                    -- 文章链接
  publish_time INTEGER,                -- 发布时间戳
  status TEXT DEFAULT 'published',     -- 状态：draft, published, deleted
  extra_info TEXT,                     -- JSON 格式的额外信息
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  UNIQUE(account_id, article_id)
);

-- 文章统计表：存储文章的阅读、点赞等数据
CREATE TABLE IF NOT EXISTS article_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  read_count INTEGER DEFAULT 0,        -- 阅读数
  like_count INTEGER DEFAULT 0,        -- 点赞数
  comment_count INTEGER DEFAULT 0,     -- 评论数
  share_count INTEGER DEFAULT 0,       -- 分享/转发数
  collect_count INTEGER DEFAULT 0,     -- 收藏数
  forward_count INTEGER DEFAULT 0,     -- 转发数（部分平台区分分享和转发）
  extra_stats TEXT,                    -- JSON 格式的额外统计数据
  recorded_at INTEGER DEFAULT (strftime('%s', 'now')),  -- 记录时间
  FOREIGN KEY (article_id) REFERENCES articles(id)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_articles_account ON articles(account_id);
CREATE INDEX IF NOT EXISTS idx_articles_publish_time ON articles(publish_time);
CREATE INDEX IF NOT EXISTS idx_article_stats_article ON article_stats(article_id);
CREATE INDEX IF NOT EXISTS idx_article_stats_recorded ON article_stats(recorded_at);

-- 插入默认平台
INSERT OR IGNORE INTO platforms (name, display_name, icon) VALUES 
  ('toutiao', '今日头条', '📰'),
  ('weixin', '微信公众号', '💬'),
  ('zhihu', '知乎', '🔍'),
  ('bilibili', 'B站', '📺'),
  ('xiaohongshu', '小红书', '📕'),
  ('douyin', '抖音', '🎵');
