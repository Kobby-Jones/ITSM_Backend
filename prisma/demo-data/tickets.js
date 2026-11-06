// prisma/demo-data/tickets.js
// 100 fictional ticket scenarios + text pools used by prisma/seed-demo.js.
// Row format: [categoryCode, priorityNumber, title, symptom, raisedByITStaff?]
//   N=NETWORK_CONNECTIVITY H=HARDWARE_ISSUES S=SOFTWARE_APPLICATION
//   A=ACCOUNT_ACCESS_IDENTITY P=PRINTING_PROBLEMS R=PRODUCTION_SYSTEMS

const CATEGORY = {
  N: 'NETWORK_CONNECTIVITY',
  H: 'HARDWARE_ISSUES',
  S: 'SOFTWARE_APPLICATION',
  A: 'ACCOUNT_ACCESS_IDENTITY',
  P: 'PRINTING_PROBLEMS',
  R: 'PRODUCTION_SYSTEMS',
};

const ROWS = [
  // ---- Network (18)
  ['N', 2, 'Wi-Fi keeps dropping in the Admin block', 'The connection drops every 10 to 15 minutes and then reconnects on its own.'],
  ['N', 3, 'No internet on wired desk port', 'The LAN port at my desk shows connected but no website will load.'],
  ['N', 1, 'Entire Finance office offline', 'None of the computers in the Finance office can reach the network or the internet.'],
  ['N', 3, 'VPN fails to connect from home', 'The VPN client stops at authenticating and then times out.'],
  ['N', 4, 'Guest Wi-Fi sign-in page does not appear', 'Visitors connect to the guest network but the sign-in page never opens.'],
  ['N', 2, 'Shared department drive unreachable', 'Opening the shared drive gives a network path not found error.'],
  ['N', 3, 'Very slow internet in the afternoons', 'Pages take over a minute to load between 2pm and 4pm every day.'],
  ['N', 3, 'Video calls freeze and drop', 'Teams meetings freeze and the audio cuts out several times an hour.'],
  ['N', 4, 'Weak Wi-Fi signal in the library annex', 'Signal shows a single bar at the back tables and pages barely load.'],
  ['N', 2, 'Intranet portal shows a DNS error', 'The intranet page will not open although other websites work normally.'],
  ['N', 3, 'Remote desktop to office PC times out', 'Remote desktop waits for a long time and then reports the PC cannot be reached.'],
  ['N', 4, 'Laptop will not auto-connect to staff Wi-Fi', 'I have to re-enter the Wi-Fi password every morning.'],
  ['N', 1, 'Ground floor access switch not responding', 'Monitoring shows the ground floor access switch is down and several offices have lost connectivity.', 1],
  ['N', 3, 'IP address conflict warning', 'Windows reports that another device on the network is using the same IP address.'],
  ['N', 2, 'Network drive disconnects while saving', 'Large reports fail to save because the drive disconnects part way through.'],
  ['N', 4, 'No working network point in the new office', 'The wall socket in the new office is dead and needs to be patched.'],
  ['N', 3, 'Packet loss to the finance cloud service', 'Monitoring shows intermittent packet loss between the office and the finance cloud application.', 1],
  ['N', 3, 'Phone hotspot works but office Wi-Fi does not', 'My laptop connects through my phone but refuses to join the office Wi-Fi.'],

  // ---- Hardware (17)
  ['H', 3, 'Laptop battery drains within an hour', 'A fully charged battery is empty after about 50 minutes of light use.'],
  ['H', 2, 'Desktop will not power on', 'Nothing happens when I press the power button after yesterday power cut.'],
  ['H', 3, 'Laptop overheating and loud fan', 'The laptop gets very hot and the fan runs at full speed even with one app open.'],
  ['H', 3, 'External monitor shows no signal', 'The second monitor stays black and says no signal.'],
  ['H', 4, 'Several keyboard keys not responding', 'The E, R and spacebar keys sometimes do nothing.'],
  ['H', 3, 'Docking station drops USB devices', 'The mouse and headset disconnect from the dock a few times a day.'],
  ['H', 2, 'Computer restarts unexpectedly', 'The PC restarts by itself, usually while I am typing, and unsaved work is lost.'],
  ['H', 4, 'Mouse pointer freezes at random', 'The pointer freezes for a few seconds and then catches up.'],
  ['H', 3, 'Boardroom projector image is distorted', 'The picture has a green tint and wobbles at the edges.'],
  ['H', 2, 'Laptop screen cracked', 'The screen cracked after a fall and part of the display is unreadable.'],
  ['H', 3, 'Laptop charger port is loose', 'The laptop only charges when the cable is held at an angle.'],
  ['H', 4, 'Request for a second monitor', 'I work with large spreadsheets and would like a second monitor.'],
  ['H', 3, 'New workstation has no audio', 'There is no sound from the speakers on the newly installed workstation.'],
  ['H', 2, 'Laptop stuck on the startup logo', 'The laptop stays on the manufacturer logo and never reaches the sign-in screen.'],
  ['H', 4, 'Webcam not detected', 'Apps report that no camera is connected to the laptop.'],
  ['H', 3, 'Replacement laptops fail imaging', 'Three replacement laptops stop at 40 percent while the standard image is applied.', 1],
  ['H', 4, 'Headset microphone crackles', 'Colleagues say my voice crackles during calls.'],

  // ---- Software (17)
  ['S', 3, 'Spreadsheet app freezes on save', 'The spreadsheet freezes for about a minute every time I press save.'],
  ['S', 3, 'Browser crashes on form submit', 'The browser closes without warning when I submit the leave request form.'],
  ['S', 2, 'Accounting software will not launch', 'The accounting application shows a splash screen and then closes.'],
  ['S', 4, 'PDF reader closes unexpectedly', 'The PDF reader closes when I open documents longer than 20 pages.'],
  ['S', 3, 'Office suite shows unlicensed product', 'A banner says the product is unlicensed and editing is disabled.'],
  ['S', 3, 'Teams reports camera not available', 'Teams says the camera is in use by another app but nothing else is open.'],
  ['S', 4, 'Software update stuck at 90 percent', 'The update has been stuck at 90 percent since this morning.'],
  ['S', 2, 'Dashboard blank after sign-in', 'After signing in to the reporting dashboard the page stays blank.'],
  ['S', 3, 'Exported reports will not open', 'Reports exported from the system produce a file that the desktop app cannot open.'],
  ['S', 4, 'Request to install a data analysis tool', 'I need a statistics tool installed for the quarterly review.'],
  ['S', 3, 'Installation blocked by policy', 'The installer says it is blocked by the administrator.'],
  ['S', 3, 'Document loses formatting after saving', 'Tables and fonts change every time I save and reopen the document.'],
  ['S', 1, 'Payroll application cannot reach its database', 'The payroll application reports a database connection error and payroll run cannot start.'],
  ['S', 3, 'Patch deployment fails on lab machines', 'The latest patch fails on 12 lab machines with error code 0x80070005.', 1],
  ['S', 3, 'Inventory app fails to synchronise', 'The inventory app shows a sync failed message and numbers do not match the main system.'],
  ['S', 4, 'Antivirus pop-up appears repeatedly', 'An antivirus notification keeps appearing every few minutes.'],
  ['S', 4, 'Email signature missing after update', 'My saved signature disappeared after the last application update.'],

  // ---- Account & Access (17)
  ['A', 3, 'Account locked after failed sign-ins', 'I typed my password wrongly a few times and now the account is locked.'],
  ['A', 3, 'Password reset link has expired', 'The reset link in my email says it has expired as soon as I click it.'],
  ['A', 2, 'MFA approval prompt never arrives', 'I never receive the approval prompt on my phone when signing in.'],
  ['A', 3, 'New staff member needs application access', 'A new colleague started today and cannot open the finance application.'],
  ['A', 3, 'Insufficient permissions error', 'The portal says I do not have permission to view the monthly report.'],
  ['A', 2, 'Single sign-on redirects to an error page', 'After entering my password I am sent to a page that says an error occurred.'],
  ['A', 4, 'Former employee account needs review', 'Access for a colleague who left last month should be reviewed and removed.', 1],
  ['A', 3, 'Cannot sign in after laptop replacement', 'Sign-in fails on my new laptop although my password works on my phone.'],
  ['A', 3, 'Manager role missing in the portal', 'I was promoted but the approval menu is not showing in the portal.'],
  ['A', 4, 'Cannot open shared folder', 'The shared project folder says access denied.'],
  ['A', 2, 'Account disabled without explanation', 'I tried to sign in this morning and was told my account is disabled.'],
  ['A', 4, 'Password reset worked but login still fails', 'I changed my password successfully but the new password is rejected.'],
  ['A', 1, 'Suspected compromised account', 'I clicked a link in a suspicious email and then received a password change notice I did not request.'],
  ['A', 3, 'MFA asked on every page', 'I am asked to approve MFA each time I open a new page.'],
  ['A', 4, 'Register a new phone for MFA', 'I replaced my phone and need to register it for multi-factor authentication.'],
  ['A', 3, 'Work email missing on mobile', 'My work mailbox stopped syncing on my phone yesterday.'],
  ['A', 4, 'Request access to a shared mailbox', 'I need access to the shared admissions mailbox for the new semester.'],

  // ---- Printing (15)
  ['P', 3, 'Printer reports a paper jam but the tray is clear', 'The printer shows a paper jam message although I removed all the paper.'],
  ['P', 3, 'Print jobs stuck in the queue', 'My documents stay in the queue and nothing prints.'],
  ['P', 4, 'Department copier prints faded pages', 'Pages from the copier are very pale on the left side.'],
  ['P', 4, 'Double-sided printing not working', 'The printer prints one side only even when duplex is selected.'],
  ['P', 3, 'Printer shows offline for me only', 'Others can print but my computer says the printer is offline.'],
  ['P', 3, 'Scanner cannot save to the shared folder', 'Scan to folder fails with an access error.'],
  ['P', 4, 'Streaks on printed pages', 'Vertical dark lines appear on every printed page.'],
  ['P', 3, 'Printer driver missing after Windows update', 'After the update the printer is listed as unknown device.'],
  ['P', 4, 'Mobile app prints a blank page', 'Printing from the mobile app produces a blank sheet.'],
  ['P', 3, 'Large PDF only partly prints', 'A 60 page PDF stops printing at about page 25.'],
  ['P', 4, 'Copier shows replace toner warning', 'The copier displays a replace toner message and prints lighter than usual.'],
  ['P', 2, 'Secure print release does not read staff card', 'The reader beeps but does not release my held print jobs.'],
  ['P', 4, 'Printer changes paper size by itself', 'Jobs set to A4 come out on letter size settings and are cut off.'],
  ['P', 3, 'Scan to email fails with connection error', 'Scan to email stops with a connection error message.'],
  ['P', 3, 'Shared printer prints every job twice', 'Every document is printed twice on the shared printer.'],

  // ---- Production systems (16)
  ['R', 1, 'Operational dashboard down for the shift team', 'The operational dashboard is unavailable and the shift team cannot see live status.'],
  ['R', 2, 'Inventory service rejects updates', 'Stock updates are rejected with a service unavailable message on and off.'],
  ['R', 1, 'Access control dashboard offline', 'The access control dashboard is not loading and gate logs are not updating.'],
  ['R', 2, 'Registration portal returns a server error', 'Staff entering new registrations see a 500 error on submit.'],
  ['R', 2, 'Payment terminal cannot synchronise transactions', 'The payment terminal keeps a queue of transactions that will not upload.'],
  ['R', 3, 'Monitoring alerts delayed at peak hours', 'Alerts arrive 20 to 30 minutes late during busy periods.'],
  ['R', 1, 'Reporting service fails at opening time', 'The daily reporting service fails to start and morning reports are not produced.'],
  ['R', 2, 'Workflow stalls when confirming a request', 'The request stays on confirming and never completes.'],
  ['R', 3, 'Service health monitor shows rising failures', 'The health monitor shows failure counts rising steadily over the past week.', 1],
  ['R', 4, 'Digital noticeboard stopped updating', 'The noticeboard in reception still shows last week announcements.'],
  ['R', 3, 'Maintenance app rejects submitted job', 'A submitted maintenance job returns validation failed with no details.'],
  ['R', 3, 'Daily operational export does not complete', 'The nightly export stops partway and produces a partial file.', 1],
  ['R', 2, 'Approval emails not reaching supervisors', 'Supervisors say they no longer receive approval request emails.'],
  ['R', 3, 'Shared service slows down every afternoon', 'The shared service becomes very slow after 2pm and recovers after 5pm.'],
  ['R', 1, 'Production form submissions fail under load', 'Form submissions time out when many staff submit at the same time.'],
  ['R', 3, 'Weekly backup job reports warnings', 'The weekly backup completed with warnings about skipped files.', 1],
];

const TICKETS = ROWS.map(([cat, pri, title, symptom, staff]) => ({
  category: CATEGORY[cat],
  priority: ['', 'P1_CRITICAL', 'P2_HIGH', 'P3_MEDIUM', 'P4_LOW'][pri],
  title,
  symptom,
  staff: !!staff,
}));

const LOCATIONS = {
  HR: ['Human Resources office', 'HR records room'],
  FIN: ['Finance office', 'Accounts section'],
  OPS: ['Operations desk', 'Operations control room'],
  ADM: ['Administration block', 'Registry'],
  LIB: ['Library main hall', 'Library annex'],
  IT: ['ICT Support Centre', 'Server room'],
};

const POOLS = {
  tried: [
    'Restarted the device and the problem returned.',
    'Closed and reopened the application with no change.',
    'Checked cables and power connections.',
    'Tried again after a short wait, same result.',
    'Asked a colleague to try, and the result was the same.',
  ],
  impact: {
    P1_CRITICAL: ['Organisation-wide', 'Multiple departments'],
    P2_HIGH: ['Department', 'Multiple departments'],
    P3_MEDIUM: ['Department', 'Individual'],
    P4_LOW: ['Individual'],
  },
  urgency: { P1_CRITICAL: 'Critical', P2_HIGH: 'High', P3_MEDIUM: 'Medium', P4_LOW: 'Low' },
  sources: ['portal', 'portal', 'portal', 'mobile', 'mobile', 'email', 'phone'],
  triage: {
    NETWORK_CONNECTIVITY: [
      'Thanks for reporting this. I am checking the access point and switch logs for your area.',
      'Received. Please keep the device connected so I can capture the connection details.',
      'I have started on this and am running basic connectivity tests from my side.',
    ],
    HARDWARE_ISSUES: [
      'Thanks for the details. I will run hardware diagnostics, please keep the device available.',
      'Received. I will check the device health report and warranty status.',
      'I have picked this up and will inspect the device shortly.',
    ],
    SOFTWARE_APPLICATION: [
      'Thanks. I am checking the application logs and the installed version on your device.',
      'Received. Please note the exact error text if it appears again.',
      'I have started investigating and will test with a clean user profile.',
    ],
    ACCOUNT_ACCESS_IDENTITY: [
      'I have received your request and will verify your identity before making any change.',
      'Thanks. I am reviewing the account status and recent sign-in activity.',
      'Picked up. I will check the group memberships linked to your role.',
    ],
    PRINTING_PROBLEMS: [
      'Thanks. I am checking the print queue and the printer status page.',
      'Received. I will test printing from another workstation to compare.',
      'I have started on this and am checking the printer driver and settings.',
    ],
    PRODUCTION_SYSTEMS: [
      'This is being treated with priority. I am checking service health and recent changes.',
      'Received. I am reviewing the application and server logs for errors.',
      'I have started on this and will post updates as soon as I find the cause.',
    ],
  },
  resolution: {
    NETWORK_CONNECTIVITY: [
      'Found a faulty uplink and replaced the patch cable. Connectivity is stable after 30 minutes of monitoring.',
      'Updated the wireless configuration and cleared the stale network profile. Please reconnect and confirm.',
      'Corrected the DNS settings for your segment. Normal access has been restored.',
    ],
    HARDWARE_ISSUES: [
      'Replaced the faulty component and tested the device for an hour. It is working normally.',
      'Reseated the connections, updated the firmware and drivers, and the fault has cleared.',
      'Issued a replacement device and moved your files across. The old unit is booked for repair.',
    ],
    SOFTWARE_APPLICATION: [
      'Repaired the installation and applied the latest update. The application now opens and saves normally.',
      'Reset the application profile and restored your settings. Issue no longer reproduces.',
      'Corrected the licence assignment and confirmed the product is activated.',
    ],
    ACCOUNT_ACCESS_IDENTITY: [
      'Identity verified and the account has been unlocked. A new temporary password was issued.',
      'Corrected the missing group membership. Please sign out and in again to refresh access.',
      'Re-registered your MFA device and tested a successful sign-in.',
    ],
    PRINTING_PROBLEMS: [
      'Cleared the print queue and restarted the print service. Test pages printed correctly.',
      'Installed the correct driver and set the printer defaults. Printing works as expected.',
      'Cleaned the rollers and replaced the consumable. Print quality is back to normal.',
    ],
    PRODUCTION_SYSTEMS: [
      'Restarted the affected service after freeing disk space. Normal operation confirmed with the shift team.',
      'Rolled back the last configuration change and the service recovered. A follow-up review is planned.',
      'Increased the service capacity and cleared the backlog. Monitoring shows stable response times.',
    ],
  },
  pending: [
    'Waiting for the requester to confirm a suitable time to access the device.',
    'Waiting for a replacement part from the supplier.',
    'Waiting for approval from the department head before proceeding.',
    'Waiting for the vendor to respond to our support case.',
  ],
  internal: [
    'Checked logs and nothing unusual so far. Will try a clean test next.',
    'Likely related to the recent change window. Will compare against a working device.',
    'Spoke to the user by phone and confirmed the symptoms. Continuing diagnosis.',
  ],
  userReply: [
    'The problem is still happening, it happened again this morning.',
    'I can be available any time after 2pm if you need to look at it.',
    'Thanks for the update, please let me know if you need more details.',
    'It seems worse today, a few more colleagues are affected.',
  ],
  thanks: ['Confirmed it is working now. Thank you!', 'All good on my side, thanks for the quick help.', 'Works fine now. Please close the ticket.'],
  escalate: [
    'Escalating for senior review because the issue affects more than one user.',
    'Escalated to the infrastructure team for deeper investigation.',
    'Escalating due to approaching SLA limit. Please prioritise.',
  ],
  manager: [
    'Reviewed the case with the technician. Additional resources have been allocated.',
    'I have contacted the vendor and will share their response here.',
    'Please keep the requester updated every 2 hours until resolved.',
  ],
};

module.exports = { TICKETS, POOLS, LOCATIONS, CATEGORY };
