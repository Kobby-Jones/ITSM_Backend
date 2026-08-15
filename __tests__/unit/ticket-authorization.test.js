// __tests__/unit/ticket-authorization.test.js
jest.mock(
  '../../src/config/database',
  () => ({
    prisma: {
      ticket: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },

      ticketComment: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },

      ticketAttachment: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },

      ticketHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
      },

      sLAConfiguration: {
        findUnique: jest.fn(),
      },

      user: {
        findUnique: jest.fn(),
      },

      $transaction: jest.fn(),
    },
  })
);

jest.mock(
  '../../src/modules/routing/routing.service',
  () => ({
    autoRouteTicket:
      jest.fn().mockResolvedValue(null),
  })
);

jest.mock(
  '../../src/modules/notifications/notifications.service',
  () => ({
    sendTicketNotification:
      jest.fn().mockResolvedValue({
        success: true,
      }),
  })
);

const {
  prisma,
} = require('../../src/config/database');

const ticketsService =
  require('../../src/modules/tickets/tickets.service');

const notificationService =
  require('../../src/modules/notifications/notifications.service');

const {
  PERMISSIONS,
} = require('../../src/shared/constants');

describe('ticket service object authorization', () => {
  const otherUsersTicket = {
    id: 'ticket-1',
    creatorId: 'owner-1',
    assigneeId: null,
    status: 'OPEN',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.ticket.findUnique.mockResolvedValue(
      otherUsersTicket
    );

    notificationService
      .sendTicketNotification
      .mockResolvedValue({
        success: true,
      });
  });

  it('blocks status changes on another user ticket', async () => {
    await expect(
      ticketsService.changeStatus(
        'ticket-1',
        'IN_PROGRESS',
        'attacker-1',
        null,
        [PERMISSIONS.TICKET_UPDATE_OWN]
      )
    ).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(
      prisma.ticket.update
    ).not.toHaveBeenCalled();
  });

  it('blocks comments on another user ticket', async () => {
    await expect(
      ticketsService.addComment(
        'ticket-1',
        'Unauthorized comment',
        'attacker-1',
        false,
        [PERMISSIONS.TICKET_READ_OWN]
      )
    ).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(
      prisma.ticketComment.create
    ).not.toHaveBeenCalled();
  });

  it('blocks attachments on another user ticket', async () => {
    await expect(
      ticketsService.addAttachment(
        'ticket-1',
        {
          filename: 'safe-name.pdf',
          originalName: 'report.pdf',
          mimetype: 'application/pdf',
          size: 100,
        },
        'attacker-1',
        [PERMISSIONS.TICKET_UPDATE_OWN]
      )
    ).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(
      prisma.ticketAttachment.create
    ).not.toHaveBeenCalled();
  });

  it('blocks reading another user ticket history', async () => {
    await expect(
      ticketsService.getTicketHistory(
        'ticket-1',
        'attacker-1',
        [PERMISSIONS.TICKET_READ_OWN]
      )
    ).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(
      prisma.ticketHistory.findMany
    ).not.toHaveBeenCalled();
  });

  it('allows update-all users to change ticket status', async () => {
    const updatedTicket = {
      ...otherUsersTicket,
      status: 'IN_PROGRESS',
    };

    prisma.ticket.update.mockResolvedValue(
      updatedTicket
    );

    prisma.ticketHistory.create.mockResolvedValue({
      id: 'history-1',
    });

    await expect(
      ticketsService.changeStatus(
        'ticket-1',
        'IN_PROGRESS',
        'technician-1',
        null,
        [PERMISSIONS.TICKET_UPDATE_ALL]
      )
    ).resolves.toEqual(updatedTicket);

    expect(
      prisma.ticket.update
    ).toHaveBeenCalledTimes(1);
  });
});