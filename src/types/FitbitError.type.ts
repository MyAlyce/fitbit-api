export interface FitbitError {
    success: boolean;
    errors:  Error[];
}

interface Error {
    errorType: string;
    message:   string;
}
