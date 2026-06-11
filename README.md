# EE Learning App

用于学习 Aspen Capital Cost Estimator (ACCE/EE) 的 Web 应用，集成 test case 数据和帮助说明。

## 1. 项目介绍

本项目包含两部分：
- **文档转换脚本**：从 Azure DevOps 仓库拉取 `.doc/.docx` 文件并转换为结构化 JSON。
- **React 前端应用**：按分类浏览、搜索、查看测试步骤并追踪学习进度。

## 2. 如何生成 Azure DevOps PAT

1. 登录 Azure DevOps。
2. 右上角头像 → **Personal access tokens**。
3. 点击 **New Token**，至少勾选代码读取权限（Code Read）。
4. 复制生成的 token。
5. 在终端设置环境变量：

```bash
export AZURE_DEVOPS_PAT="your_token_here"
```

## 3. 如何运行转换脚本

### 安装 Python 依赖

```bash
pip install -r requirements.txt
```

> `.docx` 使用 `python-docx` 解析；`.doc` 优先使用系统 `antiword`，若不可用则回退 `textract`。

### 运行脚本

```bash
python scripts/convert_docs.py --refresh --output src/data
```

可选参数：
- `--workspace`：临时 clone 目录（默认 `/tmp/ee_docs`）
- `--output`：JSON 输出目录（默认 `src/data`）
- `--refresh`：强制重新 clone
- `--pat`：直接传入 PAT（默认读取 `AZURE_DEVOPS_PAT`）

## 4. 如何启动 Web 应用

```bash
npm install
npm run dev
```

构建与校验：

```bash
npm run lint
npm run build
```

## 5. 项目结构说明

```text
ee-learning/
├── scripts/
│   ├── convert_docs.py          # Azure DevOps 文档转 JSON 脚本
│   └── index_help.py            # HTML help 文档索引脚本
├── public/
│   └── help/                    # HTML help 文档（静态资源）
├── src/
│   ├── data/                    # test case JSON 数据
│   │   └── help/                # help 索引 JSON (help-index.json)
│   ├── App.tsx                  # 主界面（仪表板/分类/详情/搜索/进度/帮助中心）
│   ├── index.css                # Tailwind 样式入口
│   └── main.tsx                 # React 启动入口
├── requirements.txt             # Python 依赖
└── package.json                 # 前端依赖和脚本
```

## 6. 如何手动添加 test case 数据

在 `src/data/` 下新增 JSON 文件，结构如下：

```json
{
  "id": "56396",
  "section": "3.3",
  "title": "Import from Aspen Plus (IPEAPEA)",
  "category": "Import",
  "tags": ["Aspen Plus", "apw", "apwz", "xml"],
  "recommended": true,
  "help": "帮助提示文本",
  "helpRefs": ["import-aspen-plus-html"],
  "subcases": [
    {
      "id": "3.3a",
      "title": ".apw & .apwz file import",
      "steps": ["step 1", "step 2"]
    }
  ],
  "steps": []
}
```

- `subcases` 和 `steps` 至少提供一种。
- `recommended: true` 的条目会显示在推荐测试列表。
- `helpRefs` 是可选数组，值为 help 文档的 `id`（或 `path`），用于在详情页关联展示 help 文档。
- 应用会自动读取 `src/data/*.json`。

## 7. 如何融入 EE Help 文档（HTML）

help 文档以静态 HTML 原样保留，并生成索引供搜索与关联。

### 运行索引脚本

```bash
pip install -r requirements.txt
python scripts/index_help.py /path/to/help-folder
```

脚本会：

1. 把 help 文件夹（HTML、图片、CSS 等）拷贝到 `public/help/`，路径保持稳定（如 `/help/xxx.html`）。
2. 递归扫描 `.htm/.html`，提取标题（`<title>` 或首个 `<h1>`）和纯文本正文。
3. 输出索引到 `src/data/help/help-index.json`，每条含 `{ id, title, path, text, tags }`。

可选参数：

- `--public-dir`：静态文件目标目录（默认 `public/help`）
- `--output`：索引输出路径（默认 `src/data/help/help-index.json`）
- `--no-copy-assets`：仅重建索引，不重新拷贝文件

### 在应用中使用

- **帮助中心**：导航栏的 "Help Center" 列出所有 help 文档，右侧用 `iframe` 内嵌展示，并可在新标签打开。
- **全局搜索**：help 文档的标题与正文已纳入搜索，结果出现在 "Help Documents" 区块。
- **关联展示**：在 test case JSON 中配置 `helpRefs`，详情页侧栏的 "Related Help" 会列出对应 help 文档。

