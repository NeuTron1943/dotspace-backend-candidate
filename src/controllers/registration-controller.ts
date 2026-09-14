import { NextFunction, Request, Response } from 'express'
import { Event, Registration, sequelize, User } from '../models'

function registrationJson(registration: Registration) {
  return {
    id: registration.id,
    eventId: registration.eventId,
    userId: registration.userId,
    createdAt: registration.createdAt,
  }
}

export async function registerForEvent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const eventId = req.params.eventId as string
    const { userId } = req.body as { userId?: string }

    await sequelize.transaction(async (transaction) => {
      // Блокируем мероприятие, на которое записывается
      // Другие транзакции, использующие это мероприятие
      // будут вынуждены ждать завершения этой
      const event = await Event.findByPk(eventId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      })

      if (!event) {
        res.status(404).json({
          error: { code: 'EVENT_NOT_FOUND', message: 'Event was not found' },
        })
        return
      }

      const user = await User.findByPk(userId, {
        transaction,
      })

      if (!user) {
        res.status(404).json({
          error: { code: 'USER_NOT_FOUND', message: 'User was not found' },
        })
        return
      }

      // Для обработки граничного случая, когда пользователь уже зарегистрирован
      // на мероприятие, и оно полное, нужно проверить существующую регистрацию до 
      // проверки заполненности мероприятия, иначе ответ был бы EVENT_FULL
      const sameRegistration = await Registration.findOne({
        where: {
          eventId,
          userId: user.id,
        },
        transaction,
      })

      if (sameRegistration) {
        res.status(200).json({
          registration: {
            id: sameRegistration.id,
            eventId: sameRegistration.eventId,
            userId: sameRegistration.userId,
            createdAt: sameRegistration.createdAt,
          },
        })
        return
      }

      // Наконец проверяем число регистраций в текущей транзакции
      // И возвращаем 409 EVENT_FULL если мероприятие заполнено
      const registrationsAmountNow = await Registration.count({
        where: { eventId },
        transaction,
      })

      if (registrationsAmountNow >= event.capacity) {
        res.status(409).json({
          error: { code: 'EVENT_FULL', message: 'The event is full, there are no free seats' },
        })
        return
      }

      const registration = await Registration.create(
        {
          eventId,
          userId: user.id,
        },
        {
          transaction,
        },
      )

      res.status(201).json({
        registration: registrationJson(registration),
      })
    })

  } catch (error) {
    next(error)
  }
}
