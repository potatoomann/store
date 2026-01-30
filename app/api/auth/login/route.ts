import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { badRequest, rateLimit } from '@/lib/api';

export async function POST(req: Request) {
    try {
        const ip = req.headers.get('x-forwarded-for') || 'local';
        const rl = rateLimit(`login:${ip}`, 10, 60_000);
        if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

        const { email, password } = await req.json();

        if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
            return badRequest('Missing email or password');
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const { password: _, ...userWithoutPassword } = user;
        return NextResponse.json(userWithoutPassword);

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
