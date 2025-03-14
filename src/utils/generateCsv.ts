import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

// Define test data types
interface Person {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    age: number;
    city: string;
    country: string;
    occupation: string;
    salary: number;
    joinDate: string;
}

const firstNames = ['John', 'Jane', 'Michael', 'Emily', 'David', 'Sarah', 'James', 'Emma'];
const lastNames = ['Smith', 'Johnson', 'Brown', 'Davis', 'Wilson', 'Taylor', 'Anderson'];
const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia'];
const countries = ['USA', 'Canada', 'UK', 'Australia', 'Germany', 'France'];
const occupations = ['Engineer', 'Doctor', 'Teacher', 'Developer', 'Designer', 'Manager'];

function getRandomElement<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateEmail(firstName: string, lastName: string): string {
    return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;
}

function generateDate(startYear: number = 2015): string {
    const start = new Date(startYear, 0, 1).getTime();
    const end = new Date().getTime();
    return new Date(start + Math.random() * (end - start)).toISOString().split('T')[0];
}

function generatePerson(id: number): Person {
    const firstName = getRandomElement(firstNames);
    const lastName = getRandomElement(lastNames);

    return {
        id,
        firstName,
        lastName,
        email: generateEmail(firstName, lastName),
        age: Math.floor(Math.random() * 40) + 20,
        city: getRandomElement(cities),
        country: getRandomElement(countries),
        occupation: getRandomElement(occupations),
        salary: Math.floor(Math.random() * 100000) + 30000,
        joinDate: generateDate()
    };
}

function generateCsvContent(recordCount: number): string {
    const headers = ['id', 'firstName', 'lastName', 'email', 'age', 'city', 'country', 'occupation', 'salary', 'joinDate'];
    const rows = [headers.join(',')];

    for (let i = 0; i < recordCount; i++) {
        const person = generatePerson(i + 1);
        const row = [
            person.id,
            person.firstName,
            person.lastName,
            person.email,
            person.age,
            `"${person.city}"`,
            person.country,
            person.occupation,
            person.salary,
            person.joinDate
        ].join(',');
        rows.push(row);
    }

    return rows.join('\n') + '\n';
}

// Ensure consistent path handling
const PROJECT_ROOT = join(__dirname, '../../');
const TEST_DATA_DIR = join(PROJECT_ROOT, 'test-data');
const largeCsvPath = join(TEST_DATA_DIR, 'large.csv');

// Ensure the test data directory exists
if (!existsSync(TEST_DATA_DIR)) {
    mkdirSync(TEST_DATA_DIR, { recursive: true });
}

// Generate the large CSV file for tests
const recordsNeeded = process.env.NODE_ENV === 'test' ? 1000 : 1000000;
console.log(`Generating ${recordsNeeded} records...`);
const content = generateCsvContent(recordsNeeded);
writeFileSync(largeCsvPath, content);
console.log(`Generated large CSV file at: ${largeCsvPath}`);

export { generateCsvContent, generatePerson, Person, TEST_DATA_DIR };