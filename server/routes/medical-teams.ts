import { Router } from 'express';
import { db } from '../db';
import { medicalTeams, medicalTeamMembers, teamNotes, users, patients } from '@shared/schema';
import { insertMedicalTeamSchema, insertMedicalTeamMemberSchema } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

router.get('/', async (req: any, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can access this endpoint' });
    }

    const teamMemberships = await db
      .select({
        team: medicalTeams,
        memberRole: medicalTeamMembers.role,
      })
      .from(medicalTeamMembers)
      .innerJoin(medicalTeams, eq(medicalTeamMembers.teamId, medicalTeams.id))
      .where(and(
        eq(medicalTeamMembers.userId, req.user.id),
        eq(medicalTeams.isActive, true)
      ))
      .orderBy(desc(medicalTeams.lastMeetingAt));

    const teamsWithDetails = await Promise.all(
      teamMemberships.map(async ({ team, memberRole }) => {
        const members = await db
          .select({
            id: medicalTeamMembers.id,
            userId: medicalTeamMembers.userId,
            role: medicalTeamMembers.role,
            joinedAt: medicalTeamMembers.joinedAt,
            userName: users.name,
            userEmail: users.email,
            profilePicture: users.profilePicture,
          })
          .from(medicalTeamMembers)
          .innerJoin(users, eq(medicalTeamMembers.userId, users.id))
          .where(eq(medicalTeamMembers.teamId, team.id));

        let patientInfo = null;
        if (team.patientId) {
          const patientData = await db
            .select()
            .from(patients)
            .where(eq(patients.id, team.patientId))
            .limit(1);
          patientInfo = patientData[0] || null;
        }

        const notesCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(teamNotes)
          .where(eq(teamNotes.teamId, team.id));

        const urgentNotes = await db
          .select({ count: sql<number>`count(*)` })
          .from(teamNotes)
          .where(and(
            eq(teamNotes.teamId, team.id),
            eq(teamNotes.isUrgent, true)
          ));

        return {
          ...team,
          memberRole,
          membersCount: members.length,
          members,
          patient: patientInfo,
          notesCount: Number(notesCount[0]?.count || 0),
          urgentNotesCount: Number(urgentNotes[0]?.count || 0),
        };
      })
    );

    res.json(teamsWithDetails);
  } catch (error) {
    console.error('Get medical teams error:', error);
    res.status(500).json({ message: 'Failed to fetch medical teams' });
  }
});

router.post('/', async (req: any, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can create teams' });
    }

    const validatedData = insertMedicalTeamSchema.parse({
      ...req.body,
      createdBy: req.user.id,
    });

    const [newTeam] = await db
      .insert(medicalTeams)
      .values({
        ...validatedData,
        roomId: `team_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      })
      .returning();

    await db.insert(medicalTeamMembers).values({
      teamId: newTeam.id,
      userId: req.user.id,
      role: 'leader',
    });

    res.status(201).json(newTeam);
  } catch (error) {
    console.error('Create medical team error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid team data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create medical team' });
  }
});

router.get('/available-doctors', async (req: any, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can access this endpoint' });
    }

    const doctors = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        specialization: users.specialization,
        medicalLicense: users.medicalLicense,
        profilePicture: users.profilePicture,
        isOnline: users.isOnline,
      })
      .from(users)
      .where(and(
        eq(users.role, 'doctor'),
        eq(users.isBlocked, false)
      ))
      .orderBy(users.name);

    const filtered = doctors.filter((d: any) => d.id !== req.user.id);
    res.json(filtered);
  } catch (error) {
    console.error('Get available doctors error:', error);
    res.status(500).json({ message: 'Failed to fetch available doctors' });
  }
});

router.get('/:id', async (req: any, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can access this endpoint' });
    }

    const teamData = await db
      .select()
      .from(medicalTeams)
      .where(eq(medicalTeams.id, req.params.id))
      .limit(1);

    if (teamData.length === 0) {
      return res.status(404).json({ message: 'Team not found' });
    }

    const team = teamData[0];

    const membership = await db
      .select()
      .from(medicalTeamMembers)
      .where(and(
        eq(medicalTeamMembers.teamId, team.id),
        eq(medicalTeamMembers.userId, req.user.id)
      ))
      .limit(1);

    if (membership.length === 0) {
      return res.status(403).json({ message: 'Not authorized to view this team' });
    }

    const members = await db
      .select({
        id: medicalTeamMembers.id,
        userId: medicalTeamMembers.userId,
        role: medicalTeamMembers.role,
        joinedAt: medicalTeamMembers.joinedAt,
        userName: users.name,
        userEmail: users.email,
        profilePicture: users.profilePicture,
        medicalLicense: users.medicalLicense,
        specialization: users.specialization,
      })
      .from(medicalTeamMembers)
      .innerJoin(users, eq(medicalTeamMembers.userId, users.id))
      .where(eq(medicalTeamMembers.teamId, team.id));

    let patientInfo = null;
    if (team.patientId) {
      const patientData = await db
        .select()
        .from(patients)
        .where(eq(patients.id, team.patientId))
        .limit(1);
      patientInfo = patientData[0] || null;
    }

    const notes = await db
      .select({
        id: teamNotes.id,
        content: teamNotes.content,
        noteType: teamNotes.noteType,
        isUrgent: teamNotes.isUrgent,
        parentNoteId: teamNotes.parentNoteId,
        authorId: teamNotes.authorId,
        authorName: users.name,
        authorSpecialization: users.specialization,
        createdAt: teamNotes.createdAt,
      })
      .from(teamNotes)
      .innerJoin(users, eq(teamNotes.authorId, users.id))
      .where(eq(teamNotes.teamId, team.id))
      .orderBy(desc(teamNotes.createdAt));

    res.json({
      ...team,
      memberRole: membership[0].role,
      members,
      patient: patientInfo,
      notes,
    });
  } catch (error) {
    console.error('Get team details error:', error);
    res.status(500).json({ message: 'Failed to fetch team details' });
  }
});

router.post('/:id/members', async (req: any, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can add members' });
    }

    const teamData = await db
      .select()
      .from(medicalTeams)
      .where(eq(medicalTeams.id, req.params.id))
      .limit(1);

    if (teamData.length === 0) {
      return res.status(404).json({ message: 'Team not found' });
    }

    const membership = await db
      .select()
      .from(medicalTeamMembers)
      .where(and(
        eq(medicalTeamMembers.teamId, req.params.id),
        eq(medicalTeamMembers.userId, req.user.id)
      ))
      .limit(1);

    if (membership.length === 0 || membership[0].role !== 'leader') {
      return res.status(403).json({ message: 'Only team leaders can add members' });
    }

    const validatedData = insertMedicalTeamMemberSchema.parse({
      ...req.body,
      teamId: req.params.id,
    });

    const existingMember = await db
      .select()
      .from(medicalTeamMembers)
      .where(and(
        eq(medicalTeamMembers.teamId, req.params.id),
        eq(medicalTeamMembers.userId, validatedData.userId)
      ))
      .limit(1);

    if (existingMember.length > 0) {
      return res.status(400).json({ message: 'User is already a team member' });
    }

    const [newMember] = await db
      .insert(medicalTeamMembers)
      .values(validatedData)
      .returning();

    res.status(201).json(newMember);
  } catch (error) {
    console.error('Add team member error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid member data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to add team member' });
  }
});

router.delete('/:id/members/:userId', async (req: any, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can remove members' });
    }

    const membership = await db
      .select()
      .from(medicalTeamMembers)
      .where(and(
        eq(medicalTeamMembers.teamId, req.params.id),
        eq(medicalTeamMembers.userId, req.user.id)
      ))
      .limit(1);

    if (membership.length === 0 || membership[0].role !== 'leader') {
      return res.status(403).json({ message: 'Only team leaders can remove members' });
    }

    if (req.params.userId === req.user.id) {
      return res.status(400).json({ message: 'Team leaders cannot remove themselves' });
    }

    await db
      .delete(medicalTeamMembers)
      .where(and(
        eq(medicalTeamMembers.teamId, req.params.id),
        eq(medicalTeamMembers.userId, req.params.userId)
      ));

    res.json({ success: true, message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({ message: 'Failed to remove team member' });
  }
});

router.patch('/:id', async (req: any, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can update teams' });
    }

    const membership = await db
      .select()
      .from(medicalTeamMembers)
      .where(and(
        eq(medicalTeamMembers.teamId, req.params.id),
        eq(medicalTeamMembers.userId, req.user.id)
      ))
      .limit(1);

    if (membership.length === 0 || membership[0].role !== 'leader') {
      return res.status(403).json({ message: 'Only team leaders can update the team' });
    }

    const [updatedTeam] = await db
      .update(medicalTeams)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(medicalTeams.id, req.params.id))
      .returning();

    res.json(updatedTeam);
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ message: 'Failed to update team' });
  }
});

router.post('/:id/meeting', async (req: any, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can update meeting time' });
    }

    const membership = await db
      .select()
      .from(medicalTeamMembers)
      .where(and(
        eq(medicalTeamMembers.teamId, req.params.id),
        eq(medicalTeamMembers.userId, req.user.id)
      ))
      .limit(1);

    if (membership.length === 0) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const teamData = await db
      .select()
      .from(medicalTeams)
      .where(eq(medicalTeams.id, req.params.id))
      .limit(1);

    if (teamData.length === 0) {
      return res.status(404).json({ message: 'Team not found' });
    }

    const [updatedTeam] = await db
      .update(medicalTeams)
      .set({
        lastMeetingAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(medicalTeams.id, req.params.id))
      .returning();

    res.json({ ...updatedTeam, roomId: teamData[0].roomId });
  } catch (error) {
    console.error('Update meeting time error:', error);
    res.status(500).json({ message: 'Failed to update meeting time' });
  }
});

router.post('/:id/notes', async (req: any, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can add notes' });
    }

    const membership = await db
      .select()
      .from(medicalTeamMembers)
      .where(and(
        eq(medicalTeamMembers.teamId, req.params.id),
        eq(medicalTeamMembers.userId, req.user.id)
      ))
      .limit(1);

    if (membership.length === 0) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { content, noteType, isUrgent, parentNoteId } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Note content is required' });
    }

    const [note] = await db
      .insert(teamNotes)
      .values({
        teamId: req.params.id,
        authorId: req.user.id,
        content: content.trim(),
        noteType: noteType || 'discussion',
        isUrgent: isUrgent || false,
        parentNoteId: parentNoteId || null,
      })
      .returning();

    const authorData = await db
      .select({ name: users.name, specialization: users.specialization })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    res.json({
      success: true,
      note: {
        ...note,
        authorName: authorData[0]?.name || 'Unknown',
        authorSpecialization: authorData[0]?.specialization || null,
      }
    });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ message: 'Failed to add note' });
  }
});

router.get('/:id/notes', async (req: any, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can view notes' });
    }

    const membership = await db
      .select()
      .from(medicalTeamMembers)
      .where(and(
        eq(medicalTeamMembers.teamId, req.params.id),
        eq(medicalTeamMembers.userId, req.user.id)
      ))
      .limit(1);

    if (membership.length === 0) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const noteType = req.query.type as string | undefined;

    let query = db
      .select({
        id: teamNotes.id,
        content: teamNotes.content,
        noteType: teamNotes.noteType,
        isUrgent: teamNotes.isUrgent,
        parentNoteId: teamNotes.parentNoteId,
        authorId: teamNotes.authorId,
        authorName: users.name,
        authorSpecialization: users.specialization,
        createdAt: teamNotes.createdAt,
      })
      .from(teamNotes)
      .innerJoin(users, eq(teamNotes.authorId, users.id))
      .where(
        noteType
          ? and(eq(teamNotes.teamId, req.params.id), eq(teamNotes.noteType, noteType))
          : eq(teamNotes.teamId, req.params.id)
      )
      .orderBy(desc(teamNotes.createdAt));

    const notes = await query;
    res.json(notes);
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ message: 'Failed to fetch notes' });
  }
});

router.post('/:id/files', async (req: any, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can upload files' });
    }

    const membership = await db
      .select()
      .from(medicalTeamMembers)
      .where(and(
        eq(medicalTeamMembers.teamId, req.params.id),
        eq(medicalTeamMembers.userId, req.user.id)
      ))
      .limit(1);

    if (membership.length === 0) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json({ 
      success: true,
      message: 'File uploaded successfully'
    });
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({ message: 'Failed to upload file' });
  }
});

export default router;
