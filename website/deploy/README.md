# VPS 主站同步

对外主站是 **foxletters.com**（1Panel VPS + EdgeOne 全球加速），canonical、sitemap、`robots.txt` 均以该域名为准。

在 `BaiShou-Next` 克隆目录内执行下面的脚本，把构建结果同步到 1Panel：

```bash
./website/deploy/update-vps-mirror.sh
```

（也可在 `website/` 目录下执行 `./deploy/update-vps-mirror.sh`。）

默认发布到 `/opt/1panel/www/sites/foxletters.com/index`，可用 `SITE_PATH=...` 覆盖。

> **首次迁移提示**：若 VPS 此前克隆的是旧仓库 `BaiShou-website`，请改用 `https://github.com/foxletters-hq/BaiShou-Next.git` 重新克隆（或使用 sparse-checkout 仅检出 `website/`），再执行上述脚本。
