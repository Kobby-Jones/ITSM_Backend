// prisma/demo-data/kb-articles.js
// 29 additional knowledge-base articles for the demo seed.
// IDs are 20000000-0000-4000-8000-0000000000NN (the original 17 use the 1000... range).
// Fields: n, title, summary, category, tc (ticket category linked to), tags, content,
//         status (default PUBLISHED), isPublic (default true), author (tech|admin|manager)

const A = (n, o) => ({
  n,
  id: `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  status: 'PUBLISHED',
  isPublic: true,
  author: 'tech',
  ...o,
});

const KB_ARTICLES = [
  // ---------------- Network & VPN
  A(1, {
    title: 'Slow Wi-Fi: how to improve your connection',
    summary: 'Simple steps to get a faster, more stable wireless connection.',
    category: 'Network & VPN', tc: 'NETWORK_CONNECTIVITY', tags: ['wifi', 'slow', 'network', 'signal'],
    content: `Slow Wi-Fi is usually caused by distance, interference or too many devices.

## Quick fixes

1. Move closer to the nearest access point and away from thick walls.
2. Turn Wi-Fi off and on again, or forget the network and reconnect.
3. Close heavy applications such as large downloads or cloud syncing.
4. Restart your device.

## Still slow?

Submit a ticket under Network Connectivity and include the location, the time of day and whether other people nearby are affected. A speed test result helps us a lot.`,
  }),
  A(2, {
    title: 'Cannot reach the intranet or shared drives from the office network',
    summary: 'What to check when internal sites or shared drives will not open but the internet works.',
    category: 'Network & VPN', tc: 'NETWORK_CONNECTIVITY', tags: ['intranet', 'shared-drive', 'dns', 'lan'],
    content: `If external websites work but internal resources do not, the cause is often name resolution or a dropped network mapping.

## Try this

- Open the address using the full name or the IP address given by IT.
- Disconnect and reconnect the network drive.
- Check that you are on the office network or connected to the VPN.
- Restart your computer to refresh network settings.

## Report it

Include the exact address you are trying to open and the error message shown.`,
  }),
  A(3, {
    title: 'Connecting to staff and guest Wi-Fi for the first time',
    summary: 'How to join the staff network on a work device and the guest network for visitors.',
    category: 'Network & VPN', tc: 'NETWORK_CONNECTIVITY', tags: ['wifi', 'guest', 'staff', 'getting-connected'],
    content: `## Staff network

Select the staff network, enter your work email and password and accept the certificate prompt. Your device will remember it.

## Guest network

Choose the guest network, open any website and complete the sign-in page that appears. Visitors receive a code from the front desk. Guest access expires after 24 hours.

## Problems

If the sign-in page does not appear, open a private browser window and go to a plain address such as example.com.`,
  }),
  A(4, {
    title: 'Video calls dropping: bandwidth and Wi-Fi tips',
    summary: 'Keep Teams and other video calls stable on busy networks.',
    category: 'Network & VPN', tc: 'NETWORK_CONNECTIVITY', tags: ['teams', 'video', 'bandwidth', 'calls'],
    content: `Video calls need a steady connection more than a fast one.

- Use a wired connection when you can.
- Close other apps that use the network during the call.
- Turn off your camera if the connection is weak, audio uses much less data.
- Sit within clear view of the access point.

If calls drop at the same time every day, tell us the time and place. That pattern helps us find congestion.`,
  }),

  // ---------------- Hardware & Devices
  A(5, {
    title: 'Laptop battery draining quickly: what to check',
    summary: 'Find out what is using your battery and when a replacement is needed.',
    category: 'Hardware & Devices', tc: 'HARDWARE_ISSUES', tags: ['laptop', 'battery', 'power'],
    content: `## Check first

1. Lower the screen brightness and turn on battery saver.
2. Open Task Manager and look for apps using a lot of power.
3. Unplug unused USB devices.
4. Install pending updates, they often contain power fixes.

## When to replace

If the battery lasts less than two hours after these checks, or the laptop shuts down at 30 percent, raise a Hardware ticket. Include the laptop asset tag.`,
  }),
  A(6, {
    title: 'Laptop runs hot and the fan is loud',
    summary: 'Cooling and safety steps for an overheating laptop.',
    category: 'Hardware & Devices', tc: 'HARDWARE_ISSUES', tags: ['laptop', 'overheating', 'fan'],
    content: `Heat and fan noise are signs the laptop is working hard or cannot cool down.

- Place it on a hard, flat surface, never on a bed or cushion.
- Keep air vents clear of dust and paper.
- Close programs you are not using.
- Restart if the fan stays loud with nothing open.

Stop using the laptop and call IT if you smell burning or the case becomes too hot to touch.`,
  }),
  A(7, {
    title: 'Blank screen or no signal on a monitor or projector',
    summary: 'Checklist for external displays that show nothing.',
    category: 'Hardware & Devices', tc: 'HARDWARE_ISSUES', tags: ['monitor', 'projector', 'display', 'no-signal'],
    content: `1. Check both ends of the video cable and the power cable.
2. Use the display menu to choose the correct input (HDMI, DisplayPort or VGA).
3. On Windows press the Windows key and P, then choose Duplicate or Extend.
4. Try a different cable or port.
5. Test the display with another computer to see whether the display or the computer is at fault.

Report the display make and model if the problem continues.`,
  }),
  A(8, {
    title: 'Docking station and USB devices keep disconnecting',
    summary: 'Stabilise a docking station that drops the mouse, keyboard or headset.',
    category: 'Hardware & Devices', tc: 'HARDWARE_ISSUES', tags: ['dock', 'usb', 'peripherals'],
    content: `- Reseat the dock cable at the laptop and at the dock.
- Plug the dock power adapter directly into a wall socket.
- Disable USB power saving: Device Manager, USB Root Hub, Power Management.
- Update the dock firmware and drivers if IT has asked you to.

If one device keeps disconnecting, try it in a different port first.`,
  }),

  // ---------------- Software & Applications
  A(9, {
    title: 'Office app freezes or crashes when saving a file',
    summary: 'Recover your work and fix repeated freezing when saving documents.',
    category: 'Software & Applications', tc: 'SOFTWARE_APPLICATION', tags: ['office', 'freeze', 'save', 'crash'],
    content: `## Protect your work

Do not close the app immediately. Wait a few minutes, as saving to a network drive can be slow.

## Fixes

1. Save a copy to your local Documents folder.
2. Start the app in safe mode and test again.
3. Disable add-ins one by one.
4. Run an online repair from Settings, Apps.

If the file is on a network drive, tell us so we can check the connection too.`,
  }),
  A(10, {
    title: 'Browser problems: clear cache, check extensions',
    summary: 'Fix pages that will not load, forms that fail and browser crashes.',
    category: 'Software & Applications', tc: 'SOFTWARE_APPLICATION', tags: ['browser', 'cache', 'extensions'],
    content: `1. Refresh the page with Ctrl and F5.
2. Open the page in a private window. If it works there, an extension is the cause.
3. Clear cached images and files from the browser settings.
4. Update the browser to the latest version.
5. Try another supported browser.

Copy the error message or take a screenshot when raising a ticket.`,
  }),
  A(11, {
    title: 'Requesting new software or a licence',
    summary: 'How to ask for software and what information speeds up approval.',
    category: 'Software & Applications', tc: 'SOFTWARE_APPLICATION', tags: ['software', 'request', 'licence', 'approval'],
    content: `Software requests are approved by your department head and checked for security by IT.

## Include in your ticket

- The name and version of the software
- The business reason
- Who will use it
- Whether a licence already exists

Standard applications are usually installed within two working days. Specialist tools may take longer.`,
  }),
  A(12, {
    title: 'Application error messages: how to capture them for IT',
    summary: 'The details that help IT fix an application error quickly.',
    category: 'Software & Applications', tc: 'SOFTWARE_APPLICATION', tags: ['error', 'screenshot', 'troubleshooting'],
    content: `## What helps most

- A screenshot showing the full error and the application window
- The time the error happened
- What you were doing just before
- Whether it happens every time or only sometimes

## How to take a screenshot

Press Windows key, Shift and S, select the area and paste it into the ticket comment.`,
  }),

  // ---------------- Access & Security
  A(13, {
    title: 'Setting up multi-factor authentication on a new phone',
    summary: 'Move your MFA approval to a replacement phone without losing access.',
    category: 'Access & Security', tc: 'ACCOUNT_ACCESS_IDENTITY', tags: ['mfa', 'phone', 'setup', 'authenticator'],
    content: `If you still have your old phone, add the new device before you reset the old one.

1. Sign in on a computer and open your security settings.
2. Choose Add sign-in method and follow the on-screen steps with the new phone.
3. Remove the old phone once the new one works.

If the old phone is lost, raise an Account Access ticket. IT will verify your identity before resetting MFA.`,
  }),
  A(14, {
    title: 'Recognising phishing emails and what to do',
    summary: 'Spot suspicious emails and act quickly if you clicked one.',
    category: 'Access & Security', tc: 'ACCOUNT_ACCESS_IDENTITY', tags: ['phishing', 'email', 'security', 'awareness'],
    content: `## Warning signs

- Urgent language, threats or unexpected prizes
- A sender address that looks slightly wrong
- Links that do not match the text shown
- Requests for passwords or payments

## If you clicked

1. Do not enter any details.
2. Change your password from a trusted device.
3. Raise a P1 Account Access ticket straight away and describe what you did.`,
  }),
  A(15, {
    title: 'Choosing a strong password you can remember',
    summary: 'Practical advice for passwords that are strong and easy to recall.',
    category: 'Access & Security', tc: 'ACCOUNT_ACCESS_IDENTITY', tags: ['password', 'security', 'best-practice'],
    content: `Length matters more than complexity.

- Use a phrase of four unrelated words and add a number and symbol.
- Never reuse a work password elsewhere.
- Never share your password, even with IT. We will never ask for it.
- Change it at once if you think it was exposed.

Your password must be at least 8 characters with upper case, lower case, a number and one of @ $ ! % * ? &.`,
  }),
  A(16, {
    title: 'Requesting access to a shared folder or application',
    summary: 'How access requests work and what approval is needed.',
    category: 'Access & Security', tc: 'ACCOUNT_ACCESS_IDENTITY', tags: ['access', 'request', 'permissions', 'shared-folder'],
    content: `Access is granted on a need-to-know basis.

1. Create an Account Access ticket.
2. State the folder or application name and the level of access (read or edit).
3. Name your manager, who will be asked to approve.

Approved requests are normally completed within one working day. After access is granted, sign out and in again so the change takes effect.`,
  }),

  // ---------------- Printing & Scanning
  A(17, {
    title: 'Connecting to a shared printer',
    summary: 'Add a network printer to your computer in a few steps.',
    category: 'Printing & Scanning', tc: 'PRINTING_PROBLEMS', tags: ['printer', 'setup', 'network-printer'],
    content: `1. Open Settings, Printers and scanners, Add device.
2. Select your printer from the list. The name is on the label on the printer.
3. Wait for the driver to install and print a test page.

If the printer is not listed, connect to the office network or VPN and try again. Otherwise raise a Printing ticket with the printer label.`,
  }),
  A(18, {
    title: 'Print jobs stuck in the queue',
    summary: 'Clear a stuck print queue and restart printing.',
    category: 'Printing & Scanning', tc: 'PRINTING_PROBLEMS', tags: ['printer', 'queue', 'spooler', 'stuck'],
    content: `## Clear the queue

1. Open the printer queue and cancel all documents.
2. Press Windows key and R, type services.msc and restart the Print Spooler service.
3. Print a single test page.

## If it keeps happening

A large or damaged file may be blocking the queue. Try saving the document as PDF and printing again, then tell IT which file caused it.`,
  }),
  A(19, {
    title: 'Scan to email or scan to folder is not working',
    summary: 'Common causes when a scanner cannot send or save documents.',
    category: 'Printing & Scanning', tc: 'PRINTING_PROBLEMS', tags: ['scanner', 'scan-to-email', 'scan-to-folder'],
    content: `- Check the printer panel for a connection or access error.
- Confirm you typed your email address correctly.
- For scan to folder, check you still have access to the destination folder.
- Try a smaller scan, a very large file may exceed the mail size limit.

Include the error code shown on the printer screen in your ticket.`,
  }),
  A(20, {
    title: 'Poor print quality: streaks, fading and smudges',
    summary: 'What each print quality symptom usually means.',
    category: 'Printing & Scanning', tc: 'PRINTING_PROBLEMS', tags: ['print-quality', 'toner', 'streaks'],
    content: `| Symptom | Likely cause |
|---|---|
| Fading on one side | Toner nearly empty or uneven |
| Vertical streaks | Dirty drum or roller |
| Smudges | Damp paper or fuser problem |

Run the printer cleaning cycle from the panel menu first. If the problem remains, IT will replace the consumable or service the unit.`,
  }),

  // ---------------- Production Systems
  A(21, {
    title: 'Operational dashboard is slow or showing old data',
    summary: 'What to check and report when a live dashboard looks out of date.',
    category: 'Production Systems', tc: 'PRODUCTION_SYSTEMS', tags: ['dashboard', 'stale-data', 'production'],
    content: `## Check

- Look at the last updated time on the dashboard.
- Refresh once. Repeated refreshes can make load worse.
- Ask a colleague whether they see the same data.

## Report

Raise a Production Systems ticket with the dashboard name, the time shown and the time it should be. If production is affected, also follow your local escalation procedure.`,
  }),
  A(22, {
    title: 'Portal or form returns a server error: what to report',
    summary: 'The details IT needs when a web form fails with an error code.',
    category: 'Production Systems', tc: 'PRODUCTION_SYSTEMS', tags: ['server-error', '500', 'portal', 'form'],
    content: `Error codes starting with 5 (such as 500 or 503) mean the problem is on the server, not on your computer.

Please do not keep resubmitting a form, as this may create duplicate records. Instead note:

1. The page address
2. The time and the code shown
3. What data you were submitting

Then raise a ticket and attach a screenshot.`,
  }),
  A(23, {
    title: 'Reporting a production outage: who to call and what to say',
    summary: 'Fast, clear reporting for outages that stop operational work.',
    category: 'Production Systems', tc: 'PRODUCTION_SYSTEMS', tags: ['outage', 'critical', 'escalation', 'p1'],
    content: `## Do this first

1. Create a ticket under Production Systems with priority P1 Critical.
2. Call the IT service desk number on your notice board.
3. Say: the system name, what no longer works, how many people are affected and since when.

## Do not

- Restart servers or equipment unless you are authorised.
- Wait to see if it fixes itself.

A P1 ticket is responded to within 15 minutes.`,
  }),
  A(24, {
    title: 'Runbook: handling a P1 production incident',
    summary: 'Internal steps for technicians and managers during a critical incident.',
    category: 'Production Systems', tc: 'PRODUCTION_SYSTEMS', tags: ['runbook', 'p1', 'internal', 'incident'],
    isPublic: false, author: 'manager',
    content: `Internal use only.

## First 15 minutes

1. Acknowledge the ticket and set status to In Progress.
2. Confirm impact and affected users, then update the requester.
3. Check recent changes and service health.
4. Escalate to the IT Manager if no cause is found in 30 minutes.

## During the incident

- Post an update in the ticket every 30 minutes.
- Record every action as a comment for the review.

## After

Resolve the ticket, then schedule a short review within three working days.`,
  }),

  // ---------------- General
  A(25, {
    title: 'IT support priorities and response times',
    summary: 'What P1 to P4 mean and how quickly you can expect a response.',
    category: 'General', tc: null, tags: ['sla', 'priority', 'response-time'],
    content: `| Priority | Meaning | Response | Resolution target |
|---|---|---|---|
| P1 Critical | Many users or operations stopped | 15 min | 4 hours |
| P2 High | A team cannot work | 1 hour | 8 hours |
| P3 Medium | One person is affected, workaround exists | 4 hours | 24 hours |
| P4 Low | Request or minor issue | 8 hours | 72 hours |

Choose the priority that matches the real impact. IT may adjust it after review.`,
  }),
  A(26, {
    title: 'Internal: verifying identity before unlocking or resetting an account',
    summary: 'Identity checks technicians must complete before changing account access.',
    category: 'Access & Security', tc: 'ACCOUNT_ACCESS_IDENTITY', tags: ['internal', 'identity', 'unlock', 'reset'],
    isPublic: false, author: 'admin',
    content: `Internal use only.

Never reset or unlock an account on the strength of a message alone.

1. Confirm the request comes from the ticket owner or their manager.
2. Verify two details: employee ID and department.
3. For high-risk accounts call back on the number held in the staff directory.
4. Record the verification in an internal comment.

Never ask for or accept a current password.`,
  }),
  A(27, {
    title: 'Working remotely: VPN, devices and security checklist',
    summary: 'Checklist for staff working away from the office.',
    category: 'General', tc: null, tags: ['remote', 'vpn', 'checklist', 'draft'],
    status: 'DRAFT', author: 'tech',
    content: `DRAFT for review.

- Connect through the VPN before opening internal systems.
- Use only approved devices.
- Lock your screen when you step away.
- Do not use public Wi-Fi without the VPN.

Contact details and the support hours section still need to be added.`,
  }),
  A(28, {
    title: 'Planned maintenance windows: how we notify you',
    summary: 'When maintenance happens and how users are told about it.',
    category: 'General', tc: null, tags: ['maintenance', 'notice', 'draft'],
    status: 'DRAFT', author: 'tech',
    content: `DRAFT for review.

Planned maintenance normally takes place on Saturday evenings. Users are notified at least three working days before through email and the notice board.

Emergency maintenance may be announced at short notice. Section on rollback communication to be added.`,
  }),
  A(29, {
    title: 'Legacy VPN client setup guide (retired)',
    summary: 'Setup instructions for the old VPN client that is no longer supported.',
    category: 'Network & VPN', tc: null, tags: ['vpn', 'legacy', 'archived'],
    status: 'ARCHIVED', author: 'admin',
    content: `This guide is retired. The legacy VPN client was replaced and is no longer supported.

Please use the current VPN guide in this knowledge base. If you still have the legacy client installed, raise a ticket and IT will remove it and install the current one.`,
  }),
];

module.exports = { KB_ARTICLES };
