# Yara — High-fi Design Execution Baseline

你现在不是产品顾问，而是 Yara 项目的 Senior Product Designer / Senior UI Designer / Design System Designer。

你的任务不是继续分析产品，而是：

# 直接基于已经确认的产品方案，完成 Yara Mobile App 的完整 Figma High-fi Design。

最终交付必须是一套：

- 完整页面
- High-fi UI
- Design System
- Components
- Variants
- Auto Layout
- Prototype
- 页面状态
- AI Native Interaction
- 可继续编辑的 Figma 文件

━━━━━━━━━━━━━━━━━━━━
01｜项目背景
━━━━━━━━━━━━━━━━━━━━

Product Name：

Yara / 雅乐

Positioning：

AI Music Companion
Music Lifestyle OS

Slogan：

Music is what feelings sound like.
AI helps you discover the music, the people, and yourself.

Yara 帮助用户：

Discover Music
Understand Music
Experience Music
Collect Music
Share Music
Remember Music

核心产品原则：

Music First.
AI Everywhere, but Quiet.

Yara 不是：

Spotify + ChatGPT

而应该让 AI 自然存在于用户：

听音乐
→ 探索音乐
→ 理解音乐
→ 看演唱会
→ 收藏唱片
→ 认识同好
→ 回顾音乐人生

的整个过程中。

━━━━━━━━━━━━━━━━━━━━
02｜Design Baseline
━━━━━━━━━━━━━━━━━━━━

我已经完成：

Product Strategy
User Research
Requirement Analysis
Product Architecture
Page Architecture
User Flow
Business Flow
Low-fi Wireframe
Yara Signature Interaction

这些内容均视为 Design Baseline。

你必须严格按照我提供的现有 Low-fi 和产品架构进行设计。

禁止：

重新设计 IA
重新划分 Navigation
擅自新增一级功能
删除现有核心功能
因为视觉原因改变页面职责
重新做 Low-fi
重新定义 User Flow

如果发现问题：

记录为 Design Issue。

不要擅自修改产品方案。

━━━━━━━━━━━━━━━━━━━━
03｜Mobile Navigation
━━━━━━━━━━━━━━━━━━━━

Mobile 一级导航固定为：

Home
Explore
Yara
Community
Me

不得修改。

━━━━━━━━━━━━━━━━━━━━
04｜Visual Direction
━━━━━━━━━━━━━━━━━━━━

Yara 的视觉关键词：

Minimal
Editorial
Warm
Emotional
Intelligent
Music-first
Contemporary

希望整体呈现：

“成熟音乐产品 × 编辑杂志感 × 安静的 AI Intelligence”

而不是传统 AI SaaS。

━━━━━━━━━━━━━━━━━━━━
05｜Brand Color
━━━━━━━━━━━━━━━━━━━━

Yara Signature Color：

Orange

请建立完整 Orange Color Scale。

建议核心 Accent 从类似：

#FF5A1F

的 warm vivid orange 开始探索。

Orange 用于：

Primary CTA
Active State
Selected State
Playing State
Yara AI Presence
Important Highlight
Progress
Focus

原则：

Orange 是 Accent，而不是 Background。

避免整个 App 大面积橙色。

━━━━━━━━━━━━━━━━━━━━
06｜Neutral Color
━━━━━━━━━━━━━━━━━━━━

建立：

Warm White
Off White
Near Black
Warm Gray
Secondary Gray
Divider
Surface

同时设计：

Light Mode
Dark Mode

Dark Mode 不使用绝对 #000000 作为所有背景。

Light Mode 也避免过于冰冷的纯白 SaaS 感。

━━━━━━━━━━━━━━━━━━━━
07｜Spotify Reference
━━━━━━━━━━━━━━━━━━━━

可以参考 Spotify 的：

Music-first hierarchy
Album artwork prominence
Content density
Horizontal discovery
Persistent playback
Mini Player
Full Player
Artist / Album information hierarchy
Fast music browsing

但是禁止复制：

Spotify Green
Spotify Navigation
Spotify Card
Spotify Player
Spotify Typography
Spotify Layout
Spotify Icon Style

目标不是：

Orange Spotify。

目标是：

建立 Yara 自己的 AI Music Companion Design Language。

━━━━━━━━━━━━━━━━━━━━
08｜Yara Signature Interaction
━━━━━━━━━━━━━━━━━━━━

必须把以下 Signature Interaction 应用到整个产品：

# Ask Yara about THIS

任何 Music Object 都可以成为 Yara Context。

例如：

Track
Album
Artist
Playlist
Concert
Festival
Venue
Vinyl
CD
Story
User
Music Moment
Journey

例如：

用户正在 Album Detail 浏览：

Siamese Dream
The Smashing Pumpkins

无需离开页面重新告诉 AI 当前对象。

页面提供：

Ask Yara about this album

点击后自动携带：

Album Context

进入：

Contextual AI Experience。

━━━━━━━━━━━━━━━━━━━━
09｜AI Presence Levels
━━━━━━━━━━━━━━━━━━━━

设计三级 AI Presence：

LEVEL 1

Ambient AI

轻量存在：

Ask Yara about this

不能抢夺音乐内容。

LEVEL 2

Assist

展开：

Context Object
Suggested Questions
Quick Input
Inline Insight

LEVEL 3

Conversation / Task

复杂任务才进入：

Full Conversation
Structured Result
Agent Task

必须让三个层级之间自然过渡。

━━━━━━━━━━━━━━━━━━━━
10｜Signature Components
━━━━━━━━━━━━━━━━━━━━

必须设计：

Yara Context Bar

Context Chip

Quick Ask

Suggested Question

Inline Yara Insight

AI Input

Conversation Message

Tool Progress

Task Progress

Citation

Memory Indicator

Structured Result

Follow-up Actions

每个组件建立：

Default
Hover（Desktop）
Pressed
Selected
Focused
Loading
Generating
Success
Error
Disabled

等必要状态。

━━━━━━━━━━━━━━━━━━━━
11｜Structured AI Results
━━━━━━━━━━━━━━━━━━━━

禁止所有 AI 结果都使用 Chat Bubble。

根据任务建立不同 Structured Result。

至少包括：

Music Recommendation Result

Music Explanation Result

Playlist Result

Concert Plan Result

Vinyl Comparison Result

Taste Match Result

Journey Reflection Result

例如 Concert Plan 应该结构化为：

Concert
Ticket
Travel
Hotel
Route
Budget
Timeline
Save Plan

而不是一整段 AI 文本。

━━━━━━━━━━━━━━━━━━━━
12｜Home
━━━━━━━━━━━━━━━━━━━━

设计完整 Home。

核心内容：

Header

Daily Brief

- Today's Picks
- Mood / Check-in
- Updates

Continue

- Continue Task
- Continue Listening

Ask Yara

Insights

- Weekly Summary
- Taste Shift
- Rediscover
- Milestone
- Anniversary

Mini Player

Bottom Navigation

Home 的核心感觉应该是：

“Yara 今天为我准备的音乐世界。”

不是普通音乐 App 的推荐信息流。

━━━━━━━━━━━━━━━━━━━━
13｜Explore
━━━━━━━━━━━━━━━━━━━━

Explore 是：

探索音乐世界。

包含：

Search

Discover

- Track
- Album
- Artist
- Playlist
- Mood
- Genre
- Lyrics
- Stories
- History
- Reviews
- Influence

Experience

- Concert
- Festival
- Venue
- Upcoming Event
- Event Calendar

Records

- Vinyl
- CD
- Box Set
- Merch
- Popular
- New Release

设计对应的：

Explore Home
Search Result
Track Detail
Album Detail
Artist Detail
Playlist Detail
Story Detail
Concert Detail
Festival Detail
Venue Detail
Record Detail

不要把所有内容做成完全相同的 Card Grid。

不同 Music Object 应具有自己的视觉特性。

━━━━━━━━━━━━━━━━━━━━
14｜Yara
━━━━━━━━━━━━━━━━━━━━

Yara 是整个产品的 AI Core。

设计：

Yara Home
Conversation
Suggested Tasks
Saved Results
Task Progress
Structured Result

Suggested Tasks：

Find Music
Understand Music
Plan a Concert
Find a Vinyl
Build a Playlist

Yara Home 不应该像普通 ChatGPT 首页。

应该让用户明显感觉：

Yara 已经知道我的音乐品味、最近在听什么以及我正在探索什么。

━━━━━━━━━━━━━━━━━━━━
15｜Community
━━━━━━━━━━━━━━━━━━━━

设计：

Community Home

Feed

- Following
- Recommended
- Trending
- Highlights

Activities

- Concert Buddy
- Live House
- Listening Party

People

- Taste Match
- Suggested
- Followers
- Following
- Groups

以及：

Post Detail
Activity Detail
Public Profile

Community 核心不是：

“音乐版 Instagram”。

而是：

Music Taste → People → Shared Experience

重点体现：

Taste Match
Shared Artists
Shared Albums
Shared Concerts
Music Compatibility

━━━━━━━━━━━━━━━━━━━━
16｜Me
━━━━━━━━━━━━━━━━━━━━

设计：

Me Home

Identity
Taste DNA

Journey
Listening History
Concert History
Music Map
Music Moments
Mood
Stories
Milestones

Collection
Tracks
Albums
Playlists
Artists
Concerts
Records

Settings

Me 的核心不是普通 Profile。

而应该表达：

“My Life Through Music.”

━━━━━━━━━━━━━━━━━━━━
17｜Player
━━━━━━━━━━━━━━━━━━━━

设计完整 Playback Experience：

Mini Player
Full Player
Queue
Lyrics

Player 需要保持 Music First。

同时允许：

Ask Yara about this track

但 AI 入口必须足够安静。

━━━━━━━━━━━━━━━━━━━━
18｜Page States
━━━━━━━━━━━━━━━━━━━━

关键页面必须考虑：

Default
Loading
Skeleton
Empty
Error
Offline
Permission
No Result
AI Generating
AI Error

不要只设计 Happy Path。

━━━━━━━━━━━━━━━━━━━━
19｜Design System
━━━━━━━━━━━━━━━━━━━━

创建独立 Figma Page：

01 Foundations

包含：

Color
Typography
Spacing
Grid
Radius
Shadow
Icon
Motion Principle

建立 Token：

Color/
Typography/
Spacing/
Radius/
Elevation/

━━━━━━━━━━━━━━━━━━━━
20｜Component Library
━━━━━━━━━━━━━━━━━━━━

创建：

02 Components

分类：

Navigation/
Music/
Content/
AI/
Social/
Journey/
Form/
Feedback/

至少建立：

Button
Icon Button
Tabs
Chip
Tag
Avatar
Input
Search
Bottom Navigation
Top Navigation
Mini Player

Track Row
Track Card
Album Card
Artist Card
Playlist Card
Concert Card
Record Card
Story Card

User Card
Taste Match
Activity Card

以及全部 Yara Signature Components。

使用：

Component
Component Set
Variants
Properties

禁止重复复制相同 UI。

━━━━━━━━━━━━━━━━━━━━
21｜Auto Layout
━━━━━━━━━━━━━━━━━━━━

所有主要页面和组件必须尽量使用：

Auto Layout

遵循：

8pt Grid

Spacing：

4
8
12
16
24
32
48
64

Mobile Margin：

16px

需要时允许 20 / 24px。

禁止大量依赖绝对定位完成正常页面布局。

━━━━━━━━━━━━━━━━━━━━
22｜Typography
━━━━━━━━━━━━━━━━━━━━

建立清晰层级：

Display
H1
H2
H3
Title
Body
Label
Caption
Metadata

音乐内容页面允许更强的 Editorial Typography。

不要让所有文字都拥有相同视觉权重。

━━━━━━━━━━━━━━━━━━━━
23｜Imagery
━━━━━━━━━━━━━━━━━━━━

音乐视觉是产品主体。

重点使用：

Album Artwork
Artist Photography
Concert Photography
Record Photography

AI 不使用：

Robot
Magic Wand
AI Orb
大量 Sparkle
Sci-fi imagery

Yara 的 Intelligence 通过：

Context
Typography
Interaction
Motion
Orange Accent
Personalization

表达。

━━━━━━━━━━━━━━━━━━━━
24｜Prototype
━━━━━━━━━━━━━━━━━━━━

创建完整可点击 Prototype。

至少打通以下核心链路：

FLOW 01

Home
→ Track
→ Play
→ Full Player

FLOW 02

Home
→ Album
→ Album Detail
→ Ask Yara
→ Inline Insight
→ Full Conversation

FLOW 03

Explore
→ Artist
→ Album
→ Track
→ Related Music

FLOW 04

Explore
→ Concert
→ Concert Detail
→ Plan with Yara
→ Concert Planning
→ Structured Result
→ Save Plan

FLOW 05

Explore
→ Record
→ Record Detail
→ Ask Yara
→ Compare Editions
→ External Purchase

FLOW 06

Yara
→ Find Music
→ Conversation
→ Recommendation Result
→ Play
→ Save

FLOW 07

Community
→ Taste Match
→ Public Profile
→ Follow
→ Activity

FLOW 08

Me
→ Journey
→ Music Moment
→ Ask Yara
→ Reflection

━━━━━━━━━━━━━━━━━━━━
25｜Figma File Structure
━━━━━━━━━━━━━━━━━━━━

最终 Figma 文件严格整理为：

00 Cover

01 Foundations

02 Components

03 Mobile — Home

04 Mobile — Explore

05 Mobile — Yara

06 Mobile — Community

07 Mobile — Me

08 Player

09 AI States

10 Prototype

11 Archive / Exploration

每个 Frame 使用统一命名。

例如：

M/HOME/Default

M/EXPLORE/Default

M/EXPLORE/TrackDetail

M/EXPLORE/AlbumDetail

M/YARA/Home

M/YARA/Conversation

M/YARA/ConcertResult

M/COMMUNITY/Home

M/COMMUNITY/Profile

M/ME/Home

M/ME/Journey

━━━━━━━━━━━━━━━━━━━━
26｜内容真实性
━━━━━━━━━━━━━━━━━━━━

不要大量使用：

Lorem Ipsum
Song 1
Artist A
Album Name

请使用合理的真实感音乐 Mock Data。

保持内容风格统一。

但不要让内容改变产品架构。

━━━━━━━━━━━━━━━━━━━━
27｜设计质量检查
━━━━━━━━━━━━━━━━━━━━

完成后进行 Design QA：

检查：

Information Hierarchy
Visual Consistency
Spacing Consistency
Component Reuse
Navigation Consistency
AI Presence
Music Content Priority
Accessibility
Contrast
Touch Target
Scroll Behavior
Prototype Dead End
Page Coverage

重点检查：

Yara 是否看起来只是 Spotify + AI Chat。

如果是：

通过 Signature Interaction 和 Contextual AI Pattern 提升 Yara 的独特性。

不要通过增加更多功能解决。

━━━━━━━━━━━━━━━━━━━━
28｜执行要求
━━━━━━━━━━━━━━━━━━━━

非常重要：

不要再次给我：

设计建议
设计分析
应该怎么做
页面描述
Wireframe 文本
Mermaid
PRD

现在进入执行阶段。

请直接创建完整、可编辑的 Figma High-fi Design。

如果工作量过大，不允许通过减少页面、减少状态、降低页面质量来完成。

应按照：

Phase 1 Foundations + Components
Phase 2 Home
Phase 3 Explore
Phase 4 Yara
Phase 5 Community
Phase 6 Me
Phase 7 Player + AI States
Phase 8 Prototype + QA

逐阶段完成。

每完成一个 Phase，保持前面的 Design System 和 Components 一致，然后继续下一 Phase。
