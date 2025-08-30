import { AuthRequest } from "../middleware/authMiddleware.js";
import { Response } from "express";
import { prisma } from "../prismaClient.js";

export const createEmployerProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const {
      companyName,
      industry,
      contactName,
      phone,
      email,
      description,
      legalInfo,
      logoUrl,
    } = req.body;

    const exists = await prisma.employerProfile.findUnique({ where: { userId } });
    if (exists) {
      return res.status(400).json({ error: "Profile already exists" });
    }

    const profile = await prisma.employerProfile.create({
      data: {
        userId,
        companyName,
        industry,
        contactName,
        phone,
        email,
        description,
        legalInfo,
        logoUrl: logoUrl ?? null,
      },
    });

    return res.status(201).json({ message: "Профиль работодателя создан", profile });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};

export const getEmployerProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const profile = await prisma.employerProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },    
    });
    if (!profile) {
      return res.status(404).json({ error: "Профиль работодателя не найден" });
    }

    return res.json({ profile });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}

export const updateEmployerProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      companyName,
      industry,
      contactName,
      phone,
      email,
      description,
      legalInfo,
      logoUrl,
    } = req.body;

    const profile = await prisma.employerProfile.findUnique({ where: { userId } });
    if (!profile) {
      return res.status(404).json({ error: "Профиль работодателя не найден" });
    }

    const updatedProfile = await prisma.employerProfile.update({
      where: { userId },
      data: {
        companyName: companyName ?? profile.companyName,
        industry: industry ?? profile.industry,
        contactName: contactName ?? profile.contactName,
        phone: phone ?? profile.phone,
        email: email ?? profile.email,
        description: description ?? profile.description,
        legalInfo: legalInfo ?? profile.legalInfo,
        logoUrl: logoUrl ?? profile.logoUrl,
      },
    });

    return res.json({ message: "Профиль работодателя обновлён", profile: updatedProfile });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export const deleteEmployerProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Проверяем, существует ли профиль
    const profile = await prisma.employerProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({ error: "Профиль работодателя не найден" });
    }

    // Удаляем профиль
    await prisma.employerProfile.delete({
      where: { userId },
    });

    return res.json({ message: "Профиль работодателя удалён" });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};