CREATE TABLE IF NOT EXISTS wallet_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  address TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS wallet_challenges_address_idx
  ON wallet_challenges (address);

ALTER TABLE nft_minting ADD COLUMN token_id TEXT;
ALTER TABLE nft_minting ADD COLUMN contract_address TEXT;
ALTER TABLE nft_minting ADD COLUMN chain_id INTEGER;
