import { test, expect } from '@playwright/test';
import { mockAuthMe, mockEquipment, setLanguage } from './helpers';

test('equipment page loads and supports edit/save flow', async ({ page }) => {
  await setLanguage(page, 'en');
  await mockAuthMe(page, 'OFFICIAL');
  await mockEquipment(page);

  await page.goto('/equipment');

  await expect(page.getByRole('heading', { name: 'Equipment and resource management' })).toBeVisible();

  const editButton = page.getByRole('button', { name: 'Edit' }).first();
  await expect(editButton).toBeVisible();
  await editButton.click();

  const saveButton = page.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeVisible();
  await saveButton.click();

  await expect(page.getByRole('button', { name: 'Edit' }).first()).toBeVisible();
});

