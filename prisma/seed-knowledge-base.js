const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const KB_ARTICLES = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    title: 'Getting started with FlowDesk: reporting an IT issue',
    summary: 'A quick guide to creating a clear support ticket in FlowDesk and attaching the information IT needs to help you.',
    category: 'Getting Started',
    tags: ['flowdesk', 'ticket', 'incident', 'getting-started', 'support'],
    content: `FlowDesk provides one place to report, track, and resolve IT support issues.

## Before you submit

- Confirm that the issue is related to an IT service, device, application, account, network connection, printer, or production system.
- Note what you were doing when the problem started.
- If an error message is visible, copy the exact wording or take a screenshot if permitted.

## Create the ticket

1. Open FlowDesk and select New Ticket.
2. Choose the category that best matches the issue.
3. Enter a short, specific title.
4. Describe what happened, what you expected to happen, and when the problem started.
5. Review any device information that FlowDesk attaches to the request.
6. Submit the ticket.

## After submission

You can open My Tickets to check the ticket status, read technician comments, and provide additional information when requested. Avoid creating duplicate tickets for the same problem unless the original ticket has been closed and the problem has returned.`,
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    title: 'How to track and update your FlowDesk ticket',
    summary: 'Learn what the common ticket statuses mean and how to provide useful follow-up information without creating a duplicate request.',
    category: 'Getting Started',
    tags: ['flowdesk', 'ticket-status', 'comments', 'tracking', 'support'],
    content: `After a ticket is submitted, FlowDesk records its progress from initial reporting through resolution.

## Common ticket statuses

- Open: the ticket has been received and is awaiting action.
- Assigned: the ticket has been routed to a technician or support team.
- In Progress: a technician is actively investigating or working on the issue.
- Pending: work is temporarily waiting for information, approval, a vendor, or another dependency.
- Resolved: a solution has been applied and the issue is expected to be fixed.
- Closed: the support process for the ticket has been completed.

## Add useful follow-up information

Open the ticket and add a comment if the symptoms change, the problem affects more users, a new error appears, or a technician requests additional information.

## Avoid duplicate tickets

If the same issue is already open, update the existing ticket instead of creating another one. This keeps the troubleshooting history in one place and helps the support team work more efficiently.`,
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    title: 'Before raising a ticket: five quick checks',
    summary: 'Simple checks that resolve many common IT problems before a support ticket is required.',
    category: 'Troubleshooting',
    tags: ['troubleshooting', 'quick-checks', 'self-service', 'restart', 'connectivity'],
    content: `Many everyday IT problems can be resolved with a few safe checks.

## 1. Check power and connections

Confirm that the device is powered on and that power, network, display, keyboard, mouse, and peripheral cables are firmly connected.

## 2. Confirm connectivity

If the problem involves an online service, check whether other websites or approved network resources can be reached.

## 3. Close and reopen the application

Save your work where possible, close the affected application completely, and reopen it.

## 4. Restart the device when safe

A restart can clear temporary software and memory problems. Do not restart equipment that controls an active production process unless your local operating procedure allows it.

## 5. Capture the symptoms

Record the exact error message, the time the issue occurred, and the steps that caused it.

If the issue remains, submit a FlowDesk ticket and include the checks you have already completed.`,
  },
  {
    id: '10000000-0000-4000-8000-000000000004',
    title: 'Production system unavailable: safe first-response checklist',
    summary: 'Initial checks for a production-facing IT system outage, with emphasis on safety, impact reporting, and timely escalation.',
    category: 'Troubleshooting',
    tags: ['production', 'outage', 'critical', 'escalation', 'safety'],
    content: `A production system outage can have operational impact, so the first response should be fast, structured, and safe.

## Confirm the impact

- Check whether the problem affects one workstation, one area, or multiple users.
- Record the name of the affected system and the time the issue started.
- Note whether production activity is stopped, degraded, or continuing with a workaround.

## Perform only safe checks

- Confirm power and network indicators on the user device.
- Check whether other approved applications or network resources are available.
- Do not restart servers, controllers, industrial systems, or production equipment unless you are specifically authorized to do so.

## Raise the incident promptly

Create a FlowDesk ticket under Production Systems and select the priority that reflects the real business impact. Include affected users, location or operational area, error messages, and any safe checks already performed.

For a widespread or business-critical outage, follow the organization's emergency escalation procedure in addition to creating the ticket.`,
  },
  {
    id: '10000000-0000-4000-8000-000000000005',
    title: 'Wi-Fi connected but there is no internet access',
    summary: 'Troubleshooting steps for a device that shows a Wi-Fi connection but cannot reach online services.',
    category: 'Network & VPN',
    tags: ['network', 'wifi', 'internet', 'connectivity', 'dns'],
    content: `If your device shows that it is connected to Wi-Fi but websites and online services are unavailable, the connection may be local only.

## Check the scope

- Try opening two approved websites or cloud services.
- Ask whether a nearby colleague on the same network has the same problem.
- If only one application is affected, the issue may be with that application rather than the network.

## Reconnect safely

1. Turn Wi-Fi off on the device.
2. Wait a few seconds.
3. Turn Wi-Fi on again and reconnect to the approved organization network.
4. Retry the service.

## Restart if appropriate

If reconnecting does not help, restart the user device when it is safe to do so.

## Raise a ticket if the problem continues

Select Network & Connectivity and include the network name, approximate location, time of failure, whether other users are affected, and whether wired connectivity is available.`,
  },
  {
    id: '10000000-0000-4000-8000-000000000006',
    title: 'VPN connection troubleshooting',
    summary: 'Common checks when a remote access VPN will not connect, disconnects repeatedly, or cannot reach internal resources.',
    category: 'Network & VPN',
    tags: ['vpn', 'network', 'remote-access', 'connectivity', 'mfa'],
    content: `A VPN requires a working internet connection before it can establish secure remote access.

## Confirm internet access first

Disconnect the VPN and verify that normal internet access is working. If there is no internet connection, troubleshoot the local network before retrying the VPN.

## Check the VPN client

- Confirm that you are using the organization-approved VPN client.
- Verify that the configured VPN address has not been changed.
- Close any other VPN applications that may conflict with the approved client.

## Check authentication

If the VPN repeatedly rejects your sign-in, confirm that your password works for other organization services and that multi-factor authentication is available.

## When to contact IT

Raise a Network & Connectivity ticket if the VPN still fails. Include the error message, your device type, whether you are working from home or another site, and whether the failure occurs before or after authentication.`,
  },
  {
    id: '10000000-0000-4000-8000-000000000007',
    title: 'Outlook cannot send or receive email',
    summary: 'Basic checks for Outlook when new mail is not arriving or messages remain stuck in the Outbox.',
    category: 'Email & Communications',
    tags: ['email', 'outlook', 'mail', 'offline', 'connectivity'],
    content: `When Outlook cannot send or receive email, first determine whether the issue is network-related, account-related, or limited to the Outlook application.

## Check connectivity

Confirm that the device can access other approved online services. If the network is unavailable, resolve the connectivity issue first.

## Check Outlook status

Look for an Offline, Disconnected, or Trying to Connect message in Outlook. If Work Offline is enabled, disable it and allow Outlook time to reconnect.

## Check the Outbox

A very large attachment or a damaged message can block outgoing mail. Review messages in the Outbox and remove or save any message that is repeatedly failing.

## Restart Outlook

Close Outlook completely and reopen it. If the issue continues, restart the device when safe.

Create a Software & Application ticket if Outlook remains unavailable. Include any error message and whether webmail works.`,
  },
  {
    id: '10000000-0000-4000-8000-000000000008',
    title: 'Teams microphone or camera is not working',
    summary: 'Checks for microphone, speaker, and camera problems during Microsoft Teams calls and meetings.',
    category: 'Email & Communications',
    tags: ['teams', 'microphone', 'camera', 'audio', 'meeting'],
    content: `Audio and camera problems are often caused by the wrong device being selected or by operating system privacy settings.

## Check the selected device

Open Teams settings and confirm that the correct speaker, microphone, and camera are selected. Use the test call feature if available.

## Check physical controls

- Confirm that a headset is firmly connected.
- Check for a hardware mute switch on the headset or laptop.
- If using an external camera, reconnect its cable.

## Check Windows permissions

Open Windows privacy settings and confirm that microphone and camera access are allowed for the application.

## Close competing applications

Another application may already be using the camera or microphone. Close unnecessary conferencing or recording applications and retry.

If the problem continues, create a Hardware or Software ticket depending on whether the device fails in other applications as well.`,
  },
  {
    id: '10000000-0000-4000-8000-000000000009',
    title: 'Forgotten password or locked account',
    summary: 'What to do when you cannot sign in because you forgot your password or your account has been locked.',
    category: 'Access & Security',
    tags: ['password', 'account', 'locked', 'access', 'identity'],
    content: `If you cannot sign in, avoid repeatedly trying passwords because repeated failures may extend an account lockout.

## Confirm the account name

Check that you are using the correct organization email address or username and that Caps Lock is not enabled.

## Use approved self-service reset options

If your organization provides a password reset portal, use that approved method and complete the required identity verification steps.

## After changing a password

Allow a short time for the new password to synchronize across services. Update saved credentials on approved mobile devices, email clients, VPN clients, and other applications that use the same account.

## Contact IT when needed

Create an Account Access & Identity ticket if self-service reset is unavailable or the account remains locked. IT staff may need to verify your identity before changing access. Never send your password in a FlowDesk ticket.`,
  },
  {
    id: '10000000-0000-4000-8000-000000000010',
    title: 'Multi-factor authentication is not working',
    summary: 'Steps to follow when an MFA prompt does not arrive, a verification code fails, or a registered device has changed.',
    category: 'Access & Security',
    tags: ['mfa', '2fa', 'security', 'authentication', 'access'],
    content: `Multi-factor authentication protects organization accounts by requiring an additional verification step.

## If no prompt arrives

- Confirm that the registered phone has network connectivity.
- Open the approved authenticator application and check for a pending request.
- Make sure notifications for the authenticator application are enabled.

## If a code is rejected

If time-based codes are used, confirm that the phone's date and time are set automatically. Incorrect device time can cause valid codes to fail.

## If you changed or lost your phone

Do not attempt to bypass MFA. Create an Account Access & Identity ticket so IT can verify your identity and update the registered authentication method according to policy.

Never approve an MFA prompt you did not initiate. Report unexpected authentication prompts to IT.`,
  },
  {
    id: '10000000-0000-4000-8000-000000000011',
    title: 'Computer is slow or freezing',
    summary: 'Safe first-line checks when a Windows computer becomes unusually slow, unresponsive, or frequently freezes.',
    category: 'Hardware & Devices',
    tags: ['hardware', 'device', 'slow', 'freezing', 'performance'],
    content: `A slow computer can be caused by high resource usage, low storage space, software problems, or hardware faults.

## Identify when the slowdown occurs

Note whether the problem begins immediately after sign-in, when a specific application opens, or only after the device has been running for some time.

## Close unnecessary applications

Save your work and close applications you are not using. Too many active applications can increase memory and processor usage.

## Check available storage

Very low disk space can affect system performance. Remove only files you are authorized to remove. Do not delete system files or organization data to create space.

## Restart the computer

Restart the device when operationally safe. If performance improves only temporarily, record that information in the ticket.

Create a Hardware Issues ticket if the device continues to freeze or if FlowDesk telemetry shows persistent high CPU, memory, or storage utilization.`,
  },
  {
    id: '10000000-0000-4000-8000-000000000012',
    title: 'External monitor, keyboard, or mouse is not detected',
    summary: 'Basic troubleshooting for common desktop peripherals that stop working or are not recognized by Windows.',
    category: 'Hardware & Devices',
    tags: ['hardware', 'monitor', 'keyboard', 'mouse', 'peripheral'],
    content: `Peripheral problems are often caused by a loose connection, incorrect display selection, a docking station issue, or a driver problem.

## Check connections

Disconnect and reconnect the affected device. If it uses a docking station, confirm that the dock has power and is properly connected to the computer.

## For an external monitor

- Confirm that the monitor is powered on.
- Check that the correct input source is selected on the monitor.
- In Windows display settings, select Detect if the screen is not shown.

## For keyboard or mouse problems

Try another approved USB port if one is available. For wireless devices, check the receiver connection and battery level.

If the device remains unavailable, create a Hardware Issues ticket and include the device type, connection type, and whether another peripheral works in the same port.`,
  },
  {
    id: '10000000-0000-4000-8000-000000000013',
    title: 'Application will not start or keeps crashing',
    summary: 'Troubleshooting steps for a desktop application that fails to open, closes unexpectedly, or displays repeated errors.',
    category: 'Software & Applications',
    tags: ['software', 'application', 'crash', 'error', 'windows'],
    content: `If an application will not open or repeatedly crashes, record the exact behavior before making changes.

## Retry the application

Close the application completely, wait a few seconds, and reopen it. If it is still running in the background, use the approved task-management process to close it.

## Restart the device

Save other work and restart the computer when safe. This can clear temporary application and memory problems.

## Check whether the issue is application-specific

Open another approved application. If several applications are failing, the issue may be broader than one software package.

## Capture the error

Copy the exact error message and note what action triggered the failure. FlowDesk may also attach recent device and error information to the ticket.

Create a Software & Application ticket if the issue continues. Do not reinstall licensed or production software unless IT instructs you to do so.`,
  },
  {
    id: '10000000-0000-4000-8000-000000000014',
    title: 'Software update or installation failed',
    summary: 'What to check when an approved application update or installation cannot complete successfully.',
    category: 'Software & Applications',
    tags: ['software', 'update', 'installation', 'application', 'error'],
    content: `Software installation failures can occur because of insufficient storage, missing permissions, network interruption, or an application dependency.

## Confirm the software is approved

Only install organization-approved applications and updates. Do not download replacement installers from unofficial websites.

## Check storage and connectivity

Confirm that the device has sufficient free storage and a stable network connection before retrying an approved installation.

## Read the error message

Record any error code or message shown by the installer. This information can help IT identify whether the problem is permissions, compatibility, licensing, or package-related.

## Avoid repeated installation attempts

If the same installation fails more than once, stop and create a Software & Application ticket. Include the application name, version if known, error message, and whether this is a new installation or an update.`,
  },
  {
    id: '10000000-0000-4000-8000-000000000015',
    title: 'Printer shows offline or print jobs are stuck',
    summary: 'Safe checks for a printer that appears offline, does not print, or has documents stuck in the print queue.',
    category: 'Hardware & Devices',
    tags: ['printer', 'printing', 'queue', 'offline', 'hardware'],
    content: `A printer may show offline because of a power, network, queue, or driver problem.

## Check the printer

- Confirm that the printer is powered on and shows no paper, toner, or hardware alert.
- If it is a shared network printer, ask whether another user can print to it.

## Check the print queue

Open Printers & scanners in Windows, select the printer, and review the queue. Cancel jobs that are clearly stuck or duplicated if you are permitted to do so.

## Confirm the correct printer

Make sure the intended printer is selected and that the application is not sending the document to an old or unavailable device.

## Restart only user-side components

Restart the user computer if appropriate. Do not restart shared print servers or network equipment unless authorized.

If the printer remains unavailable, create a Printing Problems ticket and include the printer name or asset tag, location, and any error shown on the printer display.`,
  },
  {
    id: '10000000-0000-4000-8000-000000000016',
    title: 'What information should I include in an IT support request?',
    summary: 'A checklist for writing a support request that gives technicians enough context to begin troubleshooting quickly.',
    category: 'General',
    tags: ['ticket', 'support', 'incident', 'description', 'general'],
    content: `A clear ticket reduces unnecessary follow-up questions and helps the support team begin investigation sooner.

## Include the problem

Describe what is not working in plain language. Avoid titles such as Help or Urgent without explaining the issue.

## Include the impact

State whether the issue affects only you, several users, an entire team, or an operational service. Explain whether work is stopped or whether a workaround exists.

## Include timing

Provide the approximate time the problem began and whether it happens continuously or intermittently.

## Include error information

Copy the exact error message where possible. Attach a screenshot only when it does not expose confidential or sensitive information.

## Include what you already tried

List safe troubleshooting steps you have completed, such as reconnecting to the network, restarting an application, or restarting the user device.

Never include passwords, one-time verification codes, private keys, or other authentication secrets in a FlowDesk ticket.`,
  },
];

async function resolveAuthor() {
  const preferredEmail = process.env.KB_SEED_AUTHOR_EMAIL || 'superadmin@itsm.com';

  const preferred = await prisma.user.findUnique({
    where: { email: preferredEmail },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  if (preferred) return preferred;

  const fallback = await prisma.user.findFirst({
    where: {
      status: 'ACTIVE',
      deletedAt: null,
      role: {
        name: { in: ['super_admin', 'it_manager', 'it_admin', 'it_technician'] },
      },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  if (!fallback) {
    throw new Error(
      `No suitable FlowDesk user was found to own the seeded knowledge-base articles. ` +
      `Set KB_SEED_AUTHOR_EMAIL to an existing user email and run the script again.`
    );
  }

  return fallback;
}

async function main() {
  console.log('Starting FlowDesk knowledge-base seed...');

  const author = await resolveAuthor();
  console.log(`Using article author: ${author.email}`);

  let created = 0;
  let updated = 0;

  for (const article of KB_ARTICLES) {
    const existing = await prisma.knowledgeArticle.findUnique({
      where: { id: article.id },
      select: { id: true },
    });

    await prisma.knowledgeArticle.upsert({
      where: { id: article.id },
      update: {
        title: article.title,
        summary: article.summary,
        content: article.content,
        category: article.category,
        tags: article.tags,
        status: 'PUBLISHED',
        isPublic: true,
        deletedAt: null,
        authorId: author.id,
      },
      create: {
        ...article,
        status: 'PUBLISHED',
        isPublic: true,
        authorId: author.id,
      },
    });

    if (existing) updated += 1;
    else created += 1;
  }

  console.log(`Knowledge-base seed complete. Created: ${created}, updated: ${updated}, total: ${KB_ARTICLES.length}.`);
}

main()
  .catch((error) => {
    console.error('Knowledge-base seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
