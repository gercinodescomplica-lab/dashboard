import { Manager } from '../types/manager';
import managersMock from '../mock/managers.json';

// Simulate API latency
const LATENCY_MS = 400;

export async function fetchManagers(): Promise<Manager[]> {
    return new Promise((resolve) => {
        setTimeout(() => {
            // NOTE: Replace this with actual API fetch call in the future
            // Example: 
            // const response = await fetch('/api/managers');
            // const data = await response.json();
            // resolve(data);

            resolve(managersMock as Manager[]);
        }, LATENCY_MS);
    });
}
