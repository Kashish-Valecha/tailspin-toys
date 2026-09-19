import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllCategories,
    getAllPublishers,
    getAllGameIds,
    getFilteredGames,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const insertedCategories = await db
        .insert(categories)
        .values([
            { name: 'Strategy', description: 'cat' },
            { name: 'Puzzle', description: 'cat' },
        ])
        .returning({ id: categories.id, name: categories.name });
    const insertedPublishers = await db
        .insert(publishers)
        .values([
            { name: 'Pub One', description: 'pub' },
            { name: 'Pub Two', description: 'pub' },
        ])
        .returning({ id: publishers.id, name: publishers.name });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: insertedCategories[i % insertedCategories.length].id,
            publisherId: insertedPublishers[i % insertedPublishers.length].id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Puzzle' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub Two' });
    });

    it('returns filter options ordered by name', async () => {
        await seedGames(db, 1);
        expect(await getAllCategories(db)).toEqual([
            { id: expect.any(Number), name: 'Puzzle' },
            { id: expect.any(Number), name: 'Strategy' },
        ]);
        expect(await getAllPublishers(db)).toEqual([
            { id: expect.any(Number), name: 'Pub One' },
            { id: expect.any(Number), name: 'Pub Two' },
        ]);
    });

    it('filters games by one or more categories', async () => {
        await seedGames(db, 4);
        const categoryOptions = await getAllCategories(db);
        const strategy = categoryOptions.find((category) => category.name === 'Strategy');
        const puzzle = categoryOptions.find((category) => category.name === 'Puzzle');

        const filtered = await getFilteredGames(db, {
            categoryIds: [strategy?.id ?? 0, puzzle?.id ?? 0],
        });

        expect(filtered.map((game) => game.title)).toEqual([
            'Game 01',
            'Game 02',
            'Game 03',
            'Game 04',
        ]);
    });

    it('combines category and publisher filters', async () => {
        await seedGames(db, 4);
        const categoryOptions = await getAllCategories(db);
        const publisherOptions = await getAllPublishers(db);
        const strategy = categoryOptions.find((category) => category.name === 'Strategy');
        const publisher = publisherOptions.find((item) => item.name === 'Pub One');

        const filtered = await getFilteredGames(db, {
            categoryIds: [strategy?.id ?? 0],
            publisherId: publisher?.id ?? 0,
        });

        expect(filtered.map((game) => game.title)).toEqual(['Game 02', 'Game 04']);
    });

    it('returns no games when filters do not match', async () => {
        await seedGames(db, 2);
        expect(await getFilteredGames(db, { categoryIds: [99999] })).toEqual([]);
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
