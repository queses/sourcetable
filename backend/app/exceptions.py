class AppError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class NotFoundError(AppError):
    def __init__(self, message: str):
        super().__init__(message, 404)


class BadRequestError(AppError):
    def __init__(self, message: str):
        super().__init__(message, 400)
