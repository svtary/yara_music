# Yara — Locked Page Architecture Summary

Do not create new pages unless the user explicitly approves a Page Gap.

## Home

- H-01 Home Dashboard
- Daily Brief detail carrier where needed
- Updates / notification detail carrier where needed
- Insight detail carrier where needed
  Rules: Daily Brief, Continue, Ask Yara, Insights are primarily Home sections; Continue deep-links to the owning page; Ask Yara goes to Yara with context.

## Explore

Canonical pages include Explore Home, Search Result, Track Detail, Album Detail, Artist Detail, Playlist Detail, Story Detail, Concert/Experience list carrier, Concert Detail, Festival Detail, Venue Detail, Record list carrier, Record Detail.
Lyrics / Stories / History / Reviews / Influence can live inside canonical music object details instead of becoming duplicate object pages.

## Yara

- Y-01 Yara Home
- Y-02 Conversation
- Y-03 Task Clarification
- Y-04 Task Progress
- Y-05 Structured Result
- Y-06 Saved Results
- Y-07 Conversation History
  Rules: Suggested Tasks are a module, not separate pages; task types reuse the same framework; Explore Ask Yara carries object context; Saved Results are AI outputs, not canonical Collection objects.

## Community

- C-01 Community Home
- C-02 Post Detail
- C-03 Activities
- C-04 Activity Detail
- C-05 People Discovery
- C-06 Public Profile
- C-07 Group Detail
- C-08 Messages Inbox
- C-09 Conversation
  Rules: feed views are tabs; activity types are not separate page families; People views share one discovery page. Messages Inbox filters are states of C-08. Direct and Group are variants of the single C-09 human Conversation carrier. Messaging is distinct from Yara AI Conversation. Activity Conversation is deferred.

## Me

- M-01 Me Home
- M-02 Taste DNA
- M-03 Journey
- M-04 Music Moment Detail
- M-05 Music Moment Editor
- M-06 Collection
- M-07 Memory Management
- M-08 Settings
- M-09 Privacy Settings
  Rules: Journey and Collection are separate; Memory Management = what Yara remembers; Privacy Settings = what Yara may use.
