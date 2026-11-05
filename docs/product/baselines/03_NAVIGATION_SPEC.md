# Yara — Navigation Specification Summary

## Global navigation

Mobile: Home / Explore / Yara / Community / Me.
Desktop shares the same semantics.

## Behavior

L1 pages show primary navigation. Focus/task pages may hide mobile bottom navigation while retaining parent semantics.

## Context passing

- Album Detail → Ask Yara → Y-02 with Album Context
- Concert Detail → Plan with Yara → Y-02 / task framework with Concert Context
- Record Detail → Ask Yara → Y-02 with Release / Pressing Context
- Public Profile → Ask Yara → Taste Match Context
- Journey / Music Moment → Ask Yara → personal memory context

## Community Messaging — Architecture Amendment

- Community header → C-08 Messages Inbox.
- C-08 direct row → C-09 Conversation / Direct.
- C-08 group row → C-09 Conversation / Group.
- C-06 Public Profile → Message → C-09 / Direct with public-user context.
- C-07 Group Detail → Joined → Enter Group Chat → C-09 / Group with group context.
- C-09 shared music objects → existing canonical Explore detail pages.
- Conversation back behavior returns to its originating Public Profile, Group Detail, or Messages Inbox.
- Composer plus opens a Share Music bottom sheet state; it is not a page.

## Back behavior

Push returns to source and keeps state; overlays dismiss without losing scroll/state; external links preserve prior task state where possible.

## Canonical page rule

One canonical detail page per object regardless of entry point.

## Global capabilities

Global Search / Mini Player / Full Player / Ask Yara / Save / Share / Notification / External Link / Memory Context / Permission & Privacy.
