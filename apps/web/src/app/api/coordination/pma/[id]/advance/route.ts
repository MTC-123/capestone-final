export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { getNextStep } from '@/lib/coordination/pmaSteps';
import type { PMAStepType, PMAStepEntry } from '@/types/coordination';

export const POST = withApiHandler(async (request: Request, context) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const params = await (context as unknown as { params: Promise<{ id: string }> }).params;
  const { id } = params;
  const body = await request.json();

  const workflow = await prisma.pMAWorkflow.findUnique({ where: { id } });
  if (!workflow) throw new AppError(1003);
  if (workflow.status !== 'IN_PROGRESS') throw new AppError(9003);

  const nextStep = getNextStep(workflow.currentStep as PMAStepType);
  if (!nextStep) throw new AppError(9003);

  const steps = workflow.steps as unknown as PMAStepEntry[];
  const newStepEntry: PMAStepEntry = {
    step: nextStep,
    timestamp: new Date().toISOString(),
    actor: user.cin,
    notes: body.notes || undefined,
  };

  const isLastStep = nextStep === 'AIRCRAFT_ON_SCENE';

  const updated = await prisma.pMAWorkflow.update({
    where: { id },
    data: {
      currentStep: nextStep,
      steps: [...steps, newStepEntry],
      status: isLastStep ? 'COMPLETED' : 'IN_PROGRESS',
      ...(body.aircraftType && { aircraftType: body.aircraftType }),
      ...(body.aircraftCount && { aircraftCount: body.aircraftCount }),
    },
  });

  await prisma.communicationLog.create({
    data: {
      incidentId: workflow.incidentId,
      category: 'AVIATION_REQUEST',
      message: `PMA workflow advanced to ${nextStep.replace(/_/g, ' ')}`,
      authorId: user.userId,
      authorCin: user.cin,
    },
  });

  return NextResponse.json({ workflow: updated });
});
