// __tests__/unit/errors.test.js
const {
  AppError, ValidationError, AuthenticationError,
  AuthorizationError, NotFoundError, ConflictError, RateLimitError,
} = require('../../src/shared/errors');

describe('AppError classes', () => {
  it('AppError has correct defaults', () => {
    const err = new AppError('Something failed', 503);
    expect(err.message).toBe('Something failed');
    expect(err.statusCode).toBe(503);
    expect(err.isOperational).toBe(true);
    expect(err).toBeInstanceOf(Error);
  });

  it('AuthenticationError is 401', () => {
    const err = new AuthenticationError('Not auth');
    expect(err.statusCode).toBe(401);
  });

  it('AuthorizationError is 403', () => {
    const err = new AuthorizationError('Forbidden');
    expect(err.statusCode).toBe(403);
  });

  it('NotFoundError is 404', () => {
    const err = new NotFoundError('Not found');
    expect(err.statusCode).toBe(404);
  });

  it('ConflictError is 409', () => {
    const err = new ConflictError('Conflict');
    expect(err.statusCode).toBe(409);
  });

  it('RateLimitError is 429', () => {
    const err = new RateLimitError('Slow down');
    expect(err.statusCode).toBe(429);
  });

  it('ValidationError carries errors array', () => {
    const errors = [{ field: 'email', message: 'required' }];
    const err = new ValidationError('Bad input', errors);
    expect(err.statusCode).toBe(400);
    expect(err.errors).toEqual(errors);
  });
});

// __tests__/unit/response.test.js
describe('ApiResponse', () => {
  const ApiResponse = require('../../src/shared/response');

  function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }

  it('success sends 200 with data', () => {
    const res = mockRes();
    ApiResponse.success(res, { data: { id: 1 } });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: { id: 1 } }));
  });

  it('created sends 201', () => {
    const res = mockRes();
    ApiResponse.created(res, { data: { id: 2 } });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('notFound sends 404', () => {
    const res = mockRes();
    ApiResponse.notFound(res, { message: 'Not found' });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('paginated includes pagination meta', () => {
    const res = mockRes();
    ApiResponse.paginated(res, { data: [], total: 50, page: 2, limit: 10 });
    const call = res.json.mock.calls[0][0];
    expect(call.pagination).toMatchObject({ total: 50, page: 2, limit: 10, totalPages: 5 });
  });

  it('unauthorized sends 401', () => {
    const res = mockRes();
    ApiResponse.unauthorized(res, { message: 'Unauthorized' });
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
