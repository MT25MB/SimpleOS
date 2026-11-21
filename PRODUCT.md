# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

static HTML/CSS/vanilla JS (user-specified, deployed to GitHub Pages from `docs/`)

## Users

Older adults who want a computer that is easy to read and hard to break, plus the family members or caregivers who set it up and support them. The job is to get online, talk to family, look at photos, and remember daily tasks without help desk calls.

## Product Purpose

SimpleOS is a free, open-source, immutable Linux system that removes the confusing and risky parts of a normal desktop. Success looks like a person using the computer confidently on their own, with a caregiver able to help remotely when needed.

## Positioning

The computer is built so a mistake cannot ruin it. The operating system is read-only and updates atomically, while the launcher offers only a few large, obvious choices. No other desktop is designed first for the person who is afraid of clicking the wrong thing.

## Operating Context

Set up once by a caregiver, then handed over. The daily account is called `senior` and has no admin rights. Firefox, Loupe, and RustDesk come from Flathub on first boot. Caregiver settings sit behind a PIN. Everything runs on ordinary older hardware.

## Capabilities and Constraints

Immutable bootc/Fedora Atomic image. labwc Wayland desktop with greetd autologin. Six-tile React/Electron launcher with daily reminders, PIN-protected caregiver settings, and allowlisted app launches. Firefox enterprise policies force HTTPS-Only and uBlock Origin. Must stay free, use no telemetry, and ship with zero paid dependencies.

## Brand Commitments

Name is SimpleOS. Voice is plain, calm, and kind, never salesy. Colors are pinned: slate `#0B1120` and `#1E293B`, off-white `#F8FAFC`, sky blue `#38BDF8`. Accessibility is non-negotiable: 18px minimum type, 3px focus rings, 48px tap targets, WCAG AAA ambition. Repository is `https://github.com/MT25MB/SimpleOS`.

## Evidence on Hand

Working repository with image definition, system configs, Electron launcher, ISO/VM scripts, CI publishing to GHCR, and a 76-test Vitest suite. No customer testimonials or usage statistics exist and none should be invented.

## Accessibility & Inclusion

WCAG AAA target. Large type scaling, high contrast, keyboard operation, clear focus, no jargon, and no time-limited interactions. The audience includes people with reduced vision, reduced dexterity, and low confidence with technology.
