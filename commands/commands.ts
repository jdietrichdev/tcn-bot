export const commands = [
    {
        name: 'hello',
        type: 1,
        description: 'Say hello to someone',
        options: [
            {
                name: 'user',
                description: 'Who you want to say hello to',
                type: 6,
                required: true
            }
        ]
    }
]